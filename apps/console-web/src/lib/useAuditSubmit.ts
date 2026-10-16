"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { publicRoute } from "@/lib/analytics/contract";
import { localizedPath } from "@/lib/i18n/routes";
import { useRouter } from "next/navigation";
import { argosApi, CreateAuditResponse, type AuditScope } from "@/lib/ArgosApi";
import { createLogger, safeError, sanitizeUrl } from "@/lib/logger";
import { normalizeInputUrl } from "@/lib/url";

/** Public audit creation and optional bounded polling before opening its private report link.
 * Connected analyses use ConnectedAnalysisForm and /api/account/analyses.
 */

export type AuditPhase = "idle" | "submitting" | "polling" | "redirecting" | "error";
export type AuditErrorKind = "create" | "failed" | "timeout";

type AppLogger = ReturnType<typeof createLogger>;

export type UseAuditSubmitOptions = {
  /** Logger dÃ©jÃ  contextualisÃ© (canal + route + details). */
  logger: AppLogger;
  /** Route publique fixe utilisÃ©e pour attribuer les crÃ©ations d'audit cÃ´tÃ© BFF. */
  sourceRoute?: string;
  /** FenÃªtre de polling (ms) avant redirection forcÃ©e ; 0 = redirection immÃ©diate. */
  maxWaitMs?: number;
  /** Intervalle de polling (ms). */
  pollIntervalMs?: number;
  /** Nombre maximum de polls avant timeout. */
  maxPolls?: number;
  /**
   * Ouvre le rapport dans un nouvel onglet au lieu de naviguer dans l'onglet
   * courant. Repli automatique sur une navigation mÃªme
   * onglet si le navigateur bloque la popup. DÃ©faut : `false` (landing).
   */
  openInNewTab?: boolean;
  /** NotifiÃ© aprÃ¨s crÃ©ation rÃ©ussie de l'audit . */
  onCreated?: (res: CreateAuditResponse, normalizedUrl: string) => void;
  /** NotifiÃ© Ã  chaque tick de polling (ex: animation d'Ã©tapes de la landing). */
  onPollTick?: () => void;
};

export type UseAuditSubmitResult = {
  phase: AuditPhase;
  errorKind: AuditErrorKind | null;
  /** Erreur brute de crÃ©ation, pour afficher un message prÃ©cis si besoin. */
  error: Error | null;
  submit: (rawUrl: string, captcha?: string, scope?: AuditScope) => Promise<void>;
  reset: () => void;
};

const DEFAULT_POLL_INTERVAL_MS = 2500;
const DEFAULT_MAX_POLLS = 48; // ~2 min Ã  2,5 s

export function useAuditSubmit(options: UseAuditSubmitOptions): UseAuditSubmitResult {
  const {
    logger,
    sourceRoute,
    maxWaitMs = 0,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxPolls = DEFAULT_MAX_POLLS,
    openInNewTab = false,
    onCreated,
    onPollTick,
  } = options;

  const router = useRouter();
  const { lang } = useLang();
  const [phase, setPhase] = useState<AuditPhase>("idle");
  const [errorKind, setErrorKind] = useState<AuditErrorKind | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const submittingRef = useRef(false);
  const runIdRef = useRef<string | number | null>(null);
  useEffect(() => { if (phase === "idle" || phase === "error") submittingRef.current = false; }, [phase]);
  const reportTokenRef = useRef<string | null>(null);
  const pollCountRef = useRef(0);
  const pollErrorCountRef = useRef(0);

  // RÃ©fs stables pour les callbacks : Ã©vite de relancer l'effet de polling.
  // Mises Ã  jour en effet (pas pendant le render) pour rester lint-clean.
  const onPollTickRef = useRef(onPollTick);
  const onCreatedRef = useRef(onCreated);
  useEffect(() => {
    onPollTickRef.current = onPollTick;
    onCreatedRef.current = onCreated;
  });

  const redirectToReport = useCallback(
    (reportToken: string, reason: "completed" | "timeout" | "created", polls: number) => {
      const href = localizedPath(`/report/${reportToken}`, lang);
      logger.info("audit_submit_redirect", {
        action: "redirect_to_report",
        details: { reason, runId: runIdRef.current, polls, openInNewTab },
      });

      if (openInNewTab && typeof window !== "undefined") {
        // On n'utilise pas la feature "noopener" dans window.open : plusieurs
        // navigateurs renvoient alors null mÃªme en cas de succÃ¨s, ce qui
        // fausserait la dÃ©tection de blocage. On neutralise `opener` Ã  la main
        // (protection reverse-tabnabbing, ici mÃªme origine).
        const win = window.open(href, "_blank");
        if (win) {
          win.opener = null;
          // Onglet courant inchangÃ© : on rÃ©active le formulaire.
          setPhase("idle");
          return;
        }
        // Popup bloquÃ©e â†’ repli sur une navigation dans l'onglet courant.
      }

      setPhase("redirecting");
      router.push(href);
    },
    [logger, router, openInNewTab, lang]
  );

  // Effet de polling (cas landing) : actif uniquement en phase "polling".
  useEffect(() => {
    if (phase !== "polling") return;

    // Repli : au plus tard aprÃ¨s maxWaitMs, on redirige vers la page rapport
    // mÃªme si l'analyse est encore en cours (la page /report gÃ¨re la suite).
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
        submittingRef.current = false;
        setPhase("error");
        setErrorKind("timeout");
        logger.warn("audit_submit_poll_timeout", {
          action: "poll_run_status",
          details: { polls: pollCountRef.current, runId: runIdRef.current },
        });
        return;
      }

      if (reportTokenRef.current === null) return;
      try {
        const run = await argosApi.getReportStatus(reportTokenRef.current);
        pollErrorCountRef.current = 0;

        if (run.status === "COMPLETED" && reportTokenRef.current) {
          clearInterval(id);
          clearTimeout(redirectTimer);
          redirectToReport(reportTokenRef.current, "completed", pollCountRef.current);
        } else if (run.status === "FAILED") {
          clearInterval(id);
          clearTimeout(redirectTimer);
          submittingRef.current = false;
          setPhase("error");
          setErrorKind("failed");
          logger.warn("audit_submit_failed", {
            action: "poll_run_status",
            details: { runId: runIdRef.current },
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
    async (rawUrl: string, captcha?: string, scope?: AuditScope) => {
      const trimmed = rawUrl.trim();
      if (!trimmed || submittingRef.current || (phase !== "idle" && phase !== "error")) return;
      submittingRef.current = true;

      // Prepend https:// quand le schÃ©ma est omis (ex: "example.com"),
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
        const request = {
          url: normalized,
          sourceRoute: publicRoute(sourceRoute ?? window.location.pathname),
          lang,
          ...(scope ? { scope } : {}),
        };
        const res = captcha ? await argosApi.createAudit(request,captcha) : await argosApi.createAudit(request);
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
          // Landing : poll puis redirection (tÃ´t si terminÃ©, sinon aprÃ¨s la fenÃªtre).
          setPhase("polling");
        } else if (res.reportToken) {
          // Public form: redirect immediately when no polling window is requested.
          redirectToReport(res.reportToken, "created", 0);
        } else {
          // Pas de token et pas de fenÃªtre de polling : on rÃ©active le formulaire.
          setPhase("idle");
        }
      } catch (err) {
        submittingRef.current = false;
        setPhase("error");
        setErrorKind("create");
        setError(err instanceof Error ? err : new Error(String(err)));
        logger.error("audit_submit_create_failed", {
          action: "create_audit",
          details: { error: safeError(err), url: sanitizeUrl(normalized) },
        });
      }
    },
    [phase, maxWaitMs, logger, redirectToReport, sourceRoute, lang]
  );

  const reset = useCallback(() => {
    submittingRef.current = false;
    setPhase("idle");
    setErrorKind(null);
    setError(null);
  }, []);

  return { phase, errorKind, error, submit, reset };
}
