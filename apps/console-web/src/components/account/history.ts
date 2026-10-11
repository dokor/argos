import type { AuditHistoryItem } from "@/lib/ArgosApi";
export type HistoryContext = { siteId: string; siteUrlId: string; normalizedUrl: string };
export type HistoryItem = {
  runId: string; status: string; createdAt: string; finishedAt: string | null;
  reportAvailable: boolean; publishedAt: string | null; expiresAt: string | null;
  globalScore: number | null; scoringVersion: number | null; coverage: number | null; provisional: boolean | null;
  comparison: AuditHistoryItem["comparison"];
};
export type HistoryPage = { context: HistoryContext; items: HistoryItem[]; nextCursor: string | null };
export const comparableDelta = (item: HistoryItem) => item.comparison?.reason === "COMPARABLE" ? item.comparison.globalDelta ?? null : null;
