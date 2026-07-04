"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { argosApi, CreateAuditResponse } from "@/lib/ArgosApi";
import { createLogger, safeError, sanitizeUrl } from "@/lib/logger";
import { normalizeInputUrl } from "@/lib/url";

/**
 * Hook partagé de soumission d'audit (issue #122).
 *
 * Factorise la logique « créer un audit → (optionnel) poller le statut →
 * rediriger vers le rapport » dupliquée entre le formulaire du dashboard
 * ({@code AuditForm}) et celui de la landing ({@code HeroAuditForm}).
 *
 * Deux comportements selon {@link UseAuditSubmitOptions.maxWaitMs} :
 * - `0` (défaut, dashboard) : redirige immédiatement dès qu'un `reportToken`
 *   est disponible, sans polling.
 * - `> 0` (landing) : passe en phase `polling`, redirige tôt si le run se
 *   termine, sinon au plus tard après `maxWaitMs`. La page `/report/{token}`
 *   prend ensuite le relais pour la progression live.
 */

export type AuditPhase = "idle" | "submitting" | "polling" | "redirecting" | "error";
export type AuditErrorKind = "create" | "failed" | "timeout";

type AppLogger = ReturnType<typeof createLogger>;

export type UseAuditSubmitOptions = {
  /** Logger déjà contextualisé (canal + route + details). */
  logger: AppLogger;
  /** Fenêtre de polling (ms) avant redirection forcée ; 0 = redirection immédiate. */
  maxWaitMs?: number;
  /** Intervalle de polling (ms). */
  pollIntervalMs?: number;
  /** Nombre maximum de polls avant timeout. */
  maxPolls?: number;
  /** Notifié après création réussie de l'audit (ex: MAJ liste dashboard). */
  onCreated?: (res: CreateAuditResponse, normalizedUrl: string) => void;
  /** Notifié à chaque tick de polling (ex: animation d'étapes de la landing). */
  onPollTick?: () => void;
};

export type UseAuditSubmitResult = {
  phase: AuditPhase;
  errorKind: AuditErrorKind | null;
  /** Erreur brute de création, pour afficher un message précis si besoin. */
  error: Error | null;
  submit: (rawUrl: string) => Promise<void>;
  reset: () => void;
};

const DEFAULT_POLL_INTERVAL_MS = 2500;
const DEFAULT_MAX_POLLS = 48; // ~2 min à 2,5 s

export function useAuditSubmit(options: UseAuditSubmitOptions): UseAuditSubmitResult {
  const {
    logger,
    maxWaitMs = 0,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxPolls = DEFAULT_MAX_POLLS,
    onCreated,
    onPollTick,
  } = options;

  const router = useRouter();
  const [phase, setPhase] = useState<AuditPhase>("idle");
  const [errorKind, setErrorKind] = useState<AuditErrorKind | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const runIdRef = useRef<string | number | null>(null);
  const reportTokenRef = useRef<string | null>(null);
  const pollCountRef = useRef(0);
  const pollErrorCountRef = useRef(0);

  // Réfs stables pour les callbacks : évite de relancer l'effet de polling.
  // Mises à jour en effet (pas pendant le render) pour rester lint-clean.
  const onPollTickRef = useRef(onPollTick);
  const onCreatedRef = useRef(onCreated);
  useEffect(() => {
    onPollTickRef.current = onPollTick;
    onCreatedRef.current = onCreated;
  });

  const redirectToReport = useCallback(
    (reportToken: string, reason: "completed" | "timeout" | "created", polls: number) => {
      setPhase("redirecting");
      logger.info("audit_submit_redirect", {
        action: "redirect_to_report",
        details: { reason, reportToken, runId: runIdRef.current, polls },
      });
      router.push(`/report/${reportToken}`);
    },
    [logger, router]
  );

  // Effet de polling (cas landing) : actif uniquement en phase "polling".
  useEffect(() => {
    if (phase !== "polling") return;

    // Repli : au plus tard après maxWaitMs, on redirige vers la page rapport
    // même si l'analyse est encore en cours (la page /report gère la suite).
    const redirectTimer = setTimeout(() => {
      if (reportTokenRef.current) {
        clearInterval(id);
        redirectToReport(reportTokenRef.current, "timeout", pollCountRef.current);
      }
    }, maxWaitMs);

    const id = setInterval(async () => {
      pollCountRef.current += 1;
      onPollTickRef.current?.();

      if (pollCountRef.current > maxPolls) {
        clearInterval(id);
        clearTimeout(redirectTimer);
        setPhase("error");
        setErrorKind("timeout");
        logger.warn("audit_submit_poll_timeout", {
          action: "poll_run_status",
          details: { polls: pollCountRef.current, runId: runIdRef.current },
        });
        return;
      }

      if (runIdRef.current === null) return;
      try {
        const run = await argosApi.getRunsByRunId(runIdRef.current);
        pollErrorCountRef.current = 0;

        if (run.status === "COMPLETED" && run.reportToken) {
          clearInterval(id);
          clearTimeout(redirectTimer);
          redirectToReport(run.reportToken, "completed", pollCountRef.current);
        } else if (run.status === "FAILED") {
          clearInterval(id);
          clearTimeout(redirectTimer);
          setPhase("error");
          setErrorKind("failed");
          logger.warn("audit_submit_failed", {
            action: "poll_run_status",
            details: { lastError: run.lastError, runId: run.runId },
          });
        }
      } catch (err) {
        pollErrorCountRef.current += 1;
        if (pollErrorCountRef.current === 1 || pollErrorCountRef.current % 5 === 0) {
          logger.warn("audit_submit_poll_transient_error", {
            action: "poll_run_status",
            details: {
              error: safeError(err),
              occurrence: pollErrorCountRef.current,
              runId: runIdRef.current,
            },
          });
        }
      }
    }, pollIntervalMs);

    return () => {
      clearInterval(id);
      clearTimeout(redirectTimer);
    };
  }, [phase, maxWaitMs, pollIntervalMs, maxPolls, logger, redirectToReport]);

  const submit = useCallback(
    async (rawUrl: string) => {
      const trimmed = rawUrl.trim();
      if (!trimmed || (phase !== "idle" && phase !== "error")) return;

      // Prepend https:// quand le schéma est omis (ex: "example.com"),
      // pour matcher le comportement du BFF/backend.
      const normalized = normalizeInputUrl(trimmed);
      setError(null);
      setErrorKind(null);
      setPhase("submitting");

      logger.info("audit_submit_create", {
        action: "create_audit",
        details: { hasScheme: /^https?:\/\//i.test(trimmed), url: sanitizeUrl(normalized) },
      });

      try {
        const res = await argosApi.createAudit({ url: normalized });
        runIdRef.current = res.runId;
        reportTokenRef.current = res.reportToken ?? null;
        pollCountRef.current = 0;
        pollErrorCountRef.current = 0;

        onCreatedRef.current?.(res, normalized);

        logger.info("audit_submit_created", {
          action: "poll_run_status",
          details: { runId: res.runId, status: res.status },
        });

        if (maxWaitMs > 0) {
          // Landing : poll puis redirection (tôt si terminé, sinon après la fenêtre).
          setPhase("polling");
        } else if (res.reportToken) {
          // Dashboard : redirection immédiate.
          redirectToReport(res.reportToken, "created", 0);
        } else {
          // Pas de token et pas de fenêtre de polling : on réactive le formulaire.
          setPhase("idle");
        }
      } catch (err) {
        setPhase("error");
        setErrorKind("create");
        setError(err instanceof Error ? err : new Error(String(err)));
        logger.error("audit_submit_create_failed", {
          action: "create_audit",
          details: { error: safeError(err), url: sanitizeUrl(normalized) },
        });
      }
    },
    [phase, maxWaitMs, logger, redirectToReport]
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setErrorKind(null);
    setError(null);
  }, []);

  return { phase, errorKind, error, submit, reset };
}
