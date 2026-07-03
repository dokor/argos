import { Metadata } from "next";
import { argosApi } from "@/lib/ArgosApi";
import ReportPage from "@/app/report/[token]/ReportPage";
import AuditProgressView from "@/components/report/AuditProgressView";
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

  // Analyse en cours → vue de progression (client, polling)
  logger.info("report_progress_fallback_rendered", {
    action: "render_progress_view",
    details: {
      reportToken: maskToken(token),
    },
  });
  return <AuditProgressView token={token} />;
}
