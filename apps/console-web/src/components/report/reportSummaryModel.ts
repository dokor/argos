import type { Coverage, Report } from "./types";

export function measuredScore(score: unknown, available?: boolean | null): number | undefined {
  return available !== false && typeof score === "number" && Number.isFinite(score)
    && score >= 0 && score <= 100 ? score : undefined;
}

export function globalScore(report: Report): number | undefined {
  return measuredScore(report.scores.global,
    report.scores.globalAvailable === false ? false : report.scores.coverage?.global.available);
}

export function domainScore(score: unknown, domain: string, coverage?: Coverage | null): number | undefined {
  return measuredScore(score, coverage?.domains.find(item => item.key === domain)?.available);
}

/** Display only the measured page scope; credentials, queries and fragments can contain secrets. */
export function reportScope(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`;
  } catch { return undefined; }
}

export function partialReport(report: Report): boolean {
  return report.scores.coverage?.provisional === true || report.antiBot?.detected === true
    || (typeof report.scores.completeness === "number" && report.scores.completeness < 100);
}
