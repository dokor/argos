"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { argosApi, AuditRunStatusResponse, ModuleStatus } from "@/lib/ArgosApi";
import { createLogger, safeError, maskToken } from "@/lib/logger";
import s from "./AuditProgressView.module.scss";

// ─── Icônes par statut ────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ModuleStatus["status"] }) {
  if (status === "COMPLETED") return <span className={s.iconOk} aria-label="OK">✓</span>;
  if (status === "FAILED")    return <span className={s.iconFail} aria-label="Erreur">✗</span>;
  if (status === "SKIPPED")   return <span className={s.iconSkip} aria-label="Ignoré">—</span>;
  if (status === "RUNNING")   return <span className={s.iconRunning} aria-label="En cours"><Spinner /></span>;
  return <span className={s.iconPending} aria-label="En attente">·</span>;
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
  const [runStatus, setRunStatus] = useState<AuditRunStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loggerRef = useRef(
    createLogger("report", {
      route: "/report/[token]",
      details: { reportToken: token },
    })
  );
  const lastStatusRef = useRef<AuditRunStatusResponse["status"] | null>(null);

  useEffect(() => {
    let cancelled = false;

    loggerRef.current.info("report_progress_opened", {
      action: "poll_report_status",
      details: {
        reportToken: maskToken(token),
      },
    });

    async function poll() {
      try {
        const status = await argosApi.getReportStatus(token);
        if (cancelled) return;

        setRunStatus(status);
        if (lastStatusRef.current !== status.status) {
          loggerRef.current.info("report_progress_status_changed", {
            action: "poll_report_status",
            details: {
              progressStatus: status.status,
              reportToken: status.reportToken,
              runId: status.runId,
            },
          });
          lastStatusRef.current = status.status;
        }

        if (status.status === "COMPLETED") {
          // Rapport prêt — recharge la page pour afficher le rapport complet
          loggerRef.current.info("report_progress_completed", {
            action: "refresh_report_page",
            details: {
              reportToken: status.reportToken,
              runId: status.runId,
            },
          });
          router.refresh();
          return;
        }

        if (status.status === "FAILED") {
          loggerRef.current.warn("report_progress_failed", {
            action: "poll_report_status",
            details: {
              lastError: status.lastError,
              reportToken: status.reportToken,
              runId: status.runId,
            },
          });
          setError(status.lastError ?? "L'analyse a échoué.");
          return;
        }

        // Continue à poller toutes les 1,5 s
        setTimeout(poll, 1500);
      } catch (err) {
        if (cancelled) return;
        loggerRef.current.warn("report_progress_poll_failed", {
          action: "poll_report_status",
          details: {
            error: safeError(err),
            reportToken: maskToken(token),
          },
        });
        setError(err instanceof Error ? err.message : "Erreur de connexion.");
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [token, router]);

  const modules = parseModuleStatuses(runStatus?.moduleStatuses);
  const globalStatus = runStatus?.status ?? "QUEUED";
  const completedCount = modules.filter(m => m.status === "COMPLETED").length;
  const progress = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  return (
    <div className={s.wrapper}>
      <div className={s.card}>

        {/* En-tête */}
        <div className={s.header}>
          <div className={s.headerIcon} aria-hidden>
            {error ? "✗" : globalStatus === "QUEUED" ? "⏳" : <Spinner />}
          </div>
          <div>
            <h1 className={s.title}>
              {error
                ? "Analyse échouée"
                : globalStatus === "QUEUED"
                  ? "Analyse en attente…"
                  : "Analyse en cours…"}
            </h1>
            <p className={s.subtitle}>
              {error
                ? error
                : "Argos analyse votre site. Le rapport s'affichera automatiquement."}
            </p>
          </div>
        </div>

        {/* Barre de progression globale */}
        {!error && modules.length > 0 && (
          <div className={s.progressBar} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className={s.progressFill} style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Liste des modules */}
        {modules.length > 0 && (
          <ul className={s.moduleList} aria-label="Progression des modules">
            {modules.map((m) => (
              <li key={m.id} className={`${s.moduleRow} ${s[`status_${m.status.toLowerCase()}`]}`}>
                <StatusIcon status={m.status} />
                <span className={s.moduleLabel}>{m.label}</span>
                <span className={s.moduleStatus}>{statusLabel(m.status)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Placeholder si les statuts ne sont pas encore chargés */}
        {modules.length === 0 && !error && (
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

function statusLabel(status: ModuleStatus["status"]): string {
  switch (status) {
    case "PENDING":   return "En attente";
    case "RUNNING":   return "En cours…";
    case "COMPLETED": return "Terminé";
    case "FAILED":    return "Erreur";
    case "SKIPPED":   return "Ignoré";
  }
}
