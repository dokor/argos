// Shared types and helpers for audit results

export type ScoreAggregate = {
  id: string;
  score: number;
  maxScore: number;
  ratio: number;
};

export type AuditScoreReport = {
  scoringVersion: number;
  global: ScoreAggregate;
  byModule: ScoreAggregate[];
  byTag: ScoreAggregate[];
};

export type TechInfo = {
  cms?: { name?: string; confidence?: number };
  frontendFramework?: { name?: string; confidence?: number };
  nextJs?: { isNext?: boolean };
};

export type AuditReportV2 = {
  schemaVersion: number;
  score?: AuditScoreReport;
  tech?: TechInfo;
};

export type SortKey = "date_desc" | "date_asc" | "score_desc" | "score_asc";

export function parseReport(resultJson: string | null | undefined): AuditReportV2 | null {
  if (!resultJson) return null;
  try {
    const parsed = JSON.parse(resultJson) as AuditReportV2;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function extractTechs(report: AuditReportV2 | null): string[] {
  if (!report?.tech) return [];
  const techs: string[] = [];
  if (report.tech.cms?.name) techs.push(report.tech.cms.name);
  if (report.tech.frontendFramework?.name) techs.push(report.tech.frontendFramework.name);
  if (report.tech.nextJs?.isNext) techs.push("Next.js");
  return techs;
}

export function formatPct(ratio: number): string {
  return Math.round((ratio ?? 0) * 100) + "%";
}

export function prettyJson(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

export function getGlobalScore(resultJson: string | null | undefined): number | null {
  const report = parseReport(resultJson);
  const ratio = report?.score?.global?.ratio;
  return typeof ratio === "number" ? Math.round(ratio * 100) : null;
}
