"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { argosApi, AuditRunStatusResponse, ModuleStatus } from "@/lib/ArgosApi";
import { createLogger, safeError, maskToken } from "@/lib/logger";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./AuditProgressView.module.scss";

// Intervalle de polling et plafond global (évite un polling infini si le run
// reste bloqué en QUEUED/RUNNING — scheduler down, module qui hang…).
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 160; // ~4 min à 1,5 s

type ErrorKind = "failed" | "connection" | "timeout";

// ─── Icônes par statut ────────────────────────────────────────────────────────

function StatusIcon({ status, labels }: { status: ModuleStatus["status"]; labels: Record<string, string> }) {
  if (status === "COMPLETED") return <span className={s.iconOk} aria-label={labels.ok}>✓</span>;
  if (status === "FAILED")    return <span className={s.iconFail} aria-label={labels.failed}>✗</span>;
  if (status === "SKIPPED")   return <span className={s.iconSkip} aria-label={labels.skipped}>—</span>;
  if (status === "RUNNING")   return <span className={s.iconRunning} aria-label={labels.running}><Spinner /></span>;
  return <span className={s.iconPending} aria-label={labels.pending}>·</span>;
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className={s.spinner} aria-hidden>
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2"
        strokeDasharray="20 12" strokeLinecap="round" />
    </svg>
  );
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseModuleStatuses(raw: string | null | undefined): ModuleStatus[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ModuleStatus[];
  } catch {
    return [];
  }
}

// ─── Composant principal ──────────────────────────────────────────────────────

type Props = { token: string };

export default function AuditProgressView({ token }: Props) {
  const router = useRouter();
  const { t } = useLang();
  const tp = t.report.progress;

  const [runStatus, setRunStatus] = useState<AuditRunStatusResponse | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const loggerRef = useRef(
    createLogger("report", {
      route: "/report/[token]",
      details: { reportToken: maskToken(token) },
    })
  );
  const lastStatusRef = useRef<AuditRunStatusResponse["status"] | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let polls = 0;

    loggerRef.current.info("report_progress_opened", {
      action: "poll_report_status",
      details: {
        reportToken: maskToken(token),
      },
    });

    function scheduleNext(fn: () => void) {
      timeoutRef.current = setTimeout(fn, POLL_INTERVAL_MS);
    }

    async function poll() {
      if (cancelled) return;

      if (polls >= MAX_POLLS) {
        loggerRef.current.warn("report_progress_timeout", {
          action: "poll_report_status",
          details: { reportToken: maskToken(token), polls },
        });
        setErrorKind("timeout");
        return;
      }
      polls += 1;

      try {
        const status = await argosApi.getReportStatus(token);
        if (cancelled) return;

        setRunStatus(status);
        // Un poll réussi efface une erreur de connexion transitoire précédente.
        setErrorKind((prev) => (prev === "connection" ? null : prev));
        if (lastStatusRef.current !== status.status) {
          loggerRef.current.info("report_progress_status_changed", {
            action: "poll_report_status",
            details: {
              progressStatus: status.status,
              reportToken: maskToken(token),
              runId: status.runId,
            },
          });
          lastStatusRef.current = status.status;
        }

        if (status.status === "COMPLETED") {
          // Le run est COMPLETED, mais la publication du rapport peut ne pas
          // être encore effective. On vérifie que le rapport est réellement
          // récupérable avant de recharger, sinon le server component
          // renverrait 404 et ré-afficherait cette vue → boucle de refresh.
          try {
            await argosApi.getReport(token);
          } catch {
            if (cancelled) return;
            scheduleNext(poll);
            return;
          }
          if (cancelled) return;
          loggerRef.current.info("report_progress_completed", {
            action: "refresh_report_page",
            details: { reportToken: maskToken(token), runId: status.runId },
          });
          router.refresh();
          return;
        }

        if (status.status === "FAILED") {
          loggerRef.current.warn("report_progress_failed", {
            action: "poll_report_status",
            details: {
              reportToken: maskToken(token),
              runId: status.runId,
            },
          });
          setErrorKind("failed");
          return;
        }

        scheduleNext(poll);
      } catch (err) {
        if (cancelled) return;
        loggerRef.current.warn("report_progress_poll_failed", {
          action: "poll_report_status",
          details: {
            error: safeError(err),
            reportToken: maskToken(token),
          },
        });
        // Erreur réseau transitoire : on retente jusqu'au plafond.
        setErrorKind("connection");
        scheduleNext(poll);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [token, router]);

  const modules = parseModuleStatuses(runStatus?.moduleStatuses);
  const globalStatus = runStatus?.status ?? "QUEUED";
  const completedCount = modules.filter(m => m.status === "COMPLETED").length;
  const progress = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  // Une erreur "connection" est transitoire (retry en cours) : on ne bascule
  // en vue d'erreur bloquante que pour "failed" et "timeout".
  const isBlockingError = errorKind === "failed" || errorKind === "timeout";
  const errorMessage =
    errorKind === "timeout" ? tp.timeoutError
    : errorKind === "failed" ? tp.genericError
    : errorKind === "connection" ? tp.connectionError
    : null;

  const title = isBlockingError
    ? tp.titleFailed
    : globalStatus === "QUEUED"
      ? tp.titleQueued
      : tp.titleRunning;

  return (
    <div className={s.wrapper}>
      <div className={s.card}>

        {/* En-tête */}
        <div className={s.header}>
          <div className={s.headerIcon} aria-hidden>
            {isBlockingError ? "✗" : globalStatus === "QUEUED" ? "⏳" : <Spinner />}
          </div>
          <div>
            <h1 className={s.title}>{title}</h1>
            <p className={s.subtitle}>
              {isBlockingError ? errorMessage : tp.subtitle}
            </p>
          </div>
        </div>

        {/* Barre de progression globale */}
        {!isBlockingError && modules.length > 0 && (
          <div className={s.progressBar} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className={s.progressFill} style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Liste des modules */}
        {!isBlockingError && modules.length > 0 && (
          <ul className={s.moduleList} aria-label={tp.modulesLabel}>
            {modules.map((m) => (
              <li key={m.id} className={`${s.moduleRow} ${s[`status_${m.status.toLowerCase()}`]}`}>
                <StatusIcon status={m.status} labels={tp.icon} />
                <span className={s.moduleLabel}>{m.label}</span>
                <span className={s.moduleStatus}>{tp.status[m.status]}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Placeholder si les statuts ne sont pas encore chargés */}
        {!isBlockingError && modules.length === 0 && (
          <div className={s.placeholder}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={s.skeletonRow} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}