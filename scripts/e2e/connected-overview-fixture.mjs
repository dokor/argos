// Synthetic UI fixtures derived from the versioned canonical 15/9/3/68 dataset.
import { readFile } from "node:fs/promises";
import { response as analysisResponse } from "./connected-analysis-fixture.mjs";
const canonical = JSON.parse(
  await readFile(
    new URL(
      "../../docs/connected-space/fixtures/connected-space.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
let n = 0;
export const pages = canonical.domains.flatMap((domain, di) =>
  domain.pages.map((spec) => {
    const id = String(100 + n++),
      run = String(1000 + n),
      published = spec.reportAvailable;
    const counts = (severity) =>
      canonical.rules.filter(
        (r) => r.severity === severity && spec.outcomes[r.ruleKey] === "FAIL",
      ).length;
    return {
      pageId: id,
      domainId: String(7 + di),
      hostname: domain.hostname,
      normalizedUrl: spec.url,
      latestAttempt: {
        runId: run,
        executionStatus: spec.executionStatus,
        createdAt: "2026-10-13T08:00:00Z",
        finishedAt: "2026-10-13T08:00:25Z",
      },
      latestAvailableReport: {
        runId: published ? run : "43",
        publishedAt: published
          ? "2026-10-13T08:00:25Z"
          : "2026-10-12T08:00:25Z",
        expiresAt: null,
        score: { value: 72, provisional: false, reason: null },
      },
      result: {
        pageId: id,
        runId: run,
        normalizedUrl: spec.url,
        executionStatus: spec.executionStatus,
        completeness: spec.completeness,
        score: {
          value: spec.score,
          provisional: spec.completeness === "PARTIAL",
          reason: published ? null : "ANALYSIS_FAILED",
        },
        coverage: {
          ratio: published ? (spec.completeness === "FULL" ? 1 : 0.6) : null,
          version: published ? "fixture-v1" : null,
        },
        criticalCount: published ? counts("CRITICAL") : null,
        importantCount: published ? counts("IMPORTANT") : null,
        moduleStatuses: {},
        failureReason: published ? null : "ANALYSIS_FAILED",
        reportAvailable: published,
      },
    };
  }),
);
const priority = (p) =>
  p.result?.criticalCount > 0 || p.result?.importantCount > 0;
const incomplete = (p) =>
  !p.latestAttempt ||
  (!["QUEUED", "RUNNING"].includes(p.latestAttempt.executionStatus) &&
    p.result.completeness !== "FULL");
export function response(path, params = new URLSearchParams(), mode = "") {
  let items = structuredClone(pages);
  if (mode === "empty") items = [];
  if (mode === "active") {
    items[0].latestAttempt.executionStatus = "RUNNING";
    items[0].latestAttempt.finishedAt = null;
    items[0].result = {
      ...items[0].result,
      executionStatus: "RUNNING",
      completeness: "NONE",
      reportAvailable: false,
      criticalCount: null,
      importantCount: null,
      score: { value: null, provisional: false, reason: "ANALYSIS_PENDING" },
    };
  }
  const usage = {
    offer: "FREE",
    period: "2026-10",
    timezone: "UTC",
    startsAt: "2026-10-01T00:00:00Z",
    resetsAt: "2026-11-01T00:00:00Z",
    used: 32,
    reserved: 0,
    limit: 100,
    available: 68,
    canLaunch: true,
  };
  if (mode === "unlimited") {
    usage.limit = null;
    usage.available = null;
  }
  if (mode === "zero") {
    usage.available = 0;
    usage.limit = 32;
    usage.canLaunch = false;
  }
  if (path === "/api/account/usage") return usage;
  if (path === "/api/account/overview" || path === "/api/account/pages") {
    const attention = params.get("attention"),
      query = params.get("query")?.toLowerCase() ?? "",
      limit = Number(params.get("limit") ?? 20),
      offset = Number(params.get("offset") ?? 0);
    const selected = items.filter(
      (p) =>
        (!attention ||
          (attention === "priority" && priority(p)) ||
          (attention === "incomplete" && incomplete(p)) ||
          (attention === "active" &&
            p.latestAttempt?.executionStatus === "RUNNING")) &&
        p.normalizedUrl.toLowerCase().includes(query) &&
        (!params.has("domainId") || params.get("domainId") === p.domainId),
    );
    const inventory = {
      items: selected.slice(offset, offset + limit),
      total: selected.length,
      limit,
      offset,
      snapshotAt: canonical.snapshotAt,
    };
    if (path.endsWith("/pages")) return inventory;
    const recent = (p) => ({
      attempt: p.latestAttempt,
      pageId: p.pageId,
      domainId: p.domainId,
      normalizedUrl: p.normalizedUrl,
      hostname: p.hostname,
    });
    return {
      snapshotAt: canonical.snapshotAt,
      scope: "LATEST_ATTEMPT_PER_URL",
      trackedUrls: items.length,
      priorityUrls: items.filter(priority).length,
      incompleteUrls: items.filter(incomplete).length,
      activeRuns: mode === "active" ? 1 : 0,
      usage,
      recentRuns: items.slice(0, 3).map(recent),
      priorityPages: items.filter(priority).slice(0, 5),
      activeAttempts: mode === "active" ? [recent(items[0])] : [],
      pages: inventory,
    };
  }
  const match = /^\/api\/account\/runs\/(\d+)(\/report)?$/.exec(path);
  if (match) {
    const item = pages.find((p) => p.latestAttempt.runId === match[1]);
    const fallback = analysisResponse(
      "/api/account/runs/43" + (match[2] ?? ""),
    );
    if (!item) return fallback;
    if (match[2])
      return { ...fallback, url: item.normalizedUrl, domain: item.hostname };
    return {
      ...fallback,
      runId: match[1],
      status: item.latestAttempt.executionStatus,
      historyContext: {
        siteId: item.domainId,
        siteUrlId: item.pageId,
        normalizedUrl: item.normalizedUrl,
      },
      reportAvailability: item.result.reportAvailable
        ? "AVAILABLE"
        : "UNAVAILABLE",
    };
  }
  return analysisResponse(path, params);
}
