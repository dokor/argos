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

export type TechModuleData = {
  cms?: { name?: string | null; confidence?: number };
  frontendFramework?: { name?: string | null; confidence?: number };
  nextJs?: { isNext?: boolean; confidence?: number; router?: string };
  backendHints?: string[];
  cloudflare?: boolean;
};

export type AuditModuleResult = {
  id: string;
  title?: string;
  summary?: string;
  data?: Record<string, unknown>;
  checks?: unknown[];
};

export type AuditReportV2 = {
  schemaVersion: number;
  modules?: AuditModuleResult[];
  score?: AuditScoreReport;
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
  if (!report?.modules) return [];

  const techModule = report.modules.find((m) => m.id === "tech");
  if (!techModule?.data) return [];

  const data = techModule.data as TechModuleData;
  const techs: string[] = [];
  const seen = new Set<string>();

  const add = (name: string | null | undefined) => {
    if (name && name !== "unknown" && !seen.has(name)) {
      seen.add(name);
      techs.push(name);
    }
  };

  add(data.cms?.name);
  add(data.frontendFramework?.name);
  // nextJs is already covered by frontendFramework "Next.js" in most cases;
  // add only if it slipped through (isNext true but frontendFramework missed it)
  if (data.nextJs?.isNext) add("Next.js");

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
