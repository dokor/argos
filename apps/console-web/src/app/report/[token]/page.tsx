import { Metadata } from "next";
import { ApiError, argosApi, AuditRunStatusResponse } from "@/lib/ArgosApi";
import ReportPage from "@/app/report/[token]/ReportPage";
import AuditProgressView from "@/components/report/AuditProgressView";
import ReportErrorView from "@/components/report/ReportErrorView";
import { createLogger, maskToken, safeError } from "@/lib/logger";

export const metadata: Metadata = {
  title: "Rapport Argos",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ReportPageHome({ params }: Readonly<Props>) {
  const { token } = await params;
  const logger = createLogger("report", { route: "/report/[token]" });

  // Tente de récupérer le rapport publié
  let report = null;
  try {
    report = await argosApi.getReport(token);
  } catch (error) {
    logger.warn("report_fetch_unavailable", {
      action: "fetch_report",
      details: {
        error: safeError(error),
        reportToken: maskToken(token),
      },
    });
    // 404 = rapport pas encore publié (analyse en cours) — on laisse report à null
  }

  // Rapport prêt → affichage normal
  if (report) {
    logger.info("report_fetch_succeeded", {
      action: "render_report",
      details: {
        globalScore: report.scores.global,
        reportToken: maskToken(token),
      },
    });
    return <ReportPage params={{ report }} />;
  }

  // Rapport absent : on lève l'ambiguïté via le statut du run.
  // - 404 (token inconnu/expiré) → page d'erreur "introuvable"
  // - run FAILED                 → page d'erreur "échec"
  // - QUEUED/RUNNING/COMPLETED   → vue de progression (polling ; gère la course
  //   de publication sur COMPLETED)
  // - statut injoignable (backend down, non-404) → on laisse la vue de
  //   progression retenter côté client plutôt que d'afficher un faux "introuvable".
  let status: AuditRunStatusResponse | null = null;
  try {
    status = await argosApi.getReportStatus(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      logger.info("report_not_found", {
        action: "render_error_view",
        details: { errorKind: "notFound", reportToken: maskToken(token) },
      });
      return <ReportErrorView kind="notFound" />;
    }
    logger.warn("report_status_unavailable", {
      action: "fetch_status",
      details: { error: safeError(error), reportToken: maskToken(token) },
    });
  }

  if (status?.status === "FAILED") {
    logger.info("report_failed", {
      action: "render_error_view",
      details: { errorKind: "failed", reportToken: maskToken(token) },
    });
    return <ReportErrorView kind="failed" />;
  }

  // Analyse en cours → vue de progression (client, polling)
  logger.info("report_progress_fallback_rendered", {
    action: "render_progress_view",
    details: {
      reportToken: maskToken(token),
    },
  });
  return <AuditProgressView token={token} />;
}
