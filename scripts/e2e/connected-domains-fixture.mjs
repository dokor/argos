// Synthetic visual data only; the separate domain-browser suite uses the real Java/MariaDB stack.
import { response as analysis } from "./connected-analysis-fixture.mjs";
export const stamp = "2026-10-14T09:00:00Z";
export const profile = {
  profileId: "server-default-v1",
  contractVersion: 1,
  settingsProvenance: "COLLECTOR_DEFAULTS",
  scoringVersion: 12,
  scoringFingerprint: "a".repeat(64),
};
export const limits = {
  maxUrls: 20,
  maxDepth: 2,
  durationSeconds: 90,
  requestsPerHost: 40,
};
export const counts = {
  selectedPages: 6,
  completePages: 3,
  partialPages: 1,
  failedPages: 1,
  canceledPages: 0,
  activePages: 0,
  priorityPages: 3,
  unknownPages: 1,
};
export const pages = [
  "/",
  "/produits",
  "/contact",
  "/documentation/installation-et-configuration-avancee",
  "/espace-client",
  "/mentions-legales",
].map((path, index) => ({
  pageId: String(index + 101),
  normalizedUrl: "https://atelier.example" + path,
  runId: index === 0 ? "43" : String(45 + index),
  executionStatus: index === 4 ? "FAILED" : "COMPLETED",
  completeness:
    index === 3
      ? "PARTIAL"
      : index === 4
        ? "NONE"
        : index === 5
          ? "UNKNOWN"
          : "FULL",
  score: {
    value: index >= 4 ? null : 78 - index * 12,
    provisional: index >= 3,
    reason: index >= 4 ? "REPORT_UNAVAILABLE" : null,
  },
  coverage: { ratio: index >= 4 ? null : index === 3 ? 0.6 : 1, version: "v1" },
  criticalCount: index >= 4 ? null : index < 2 ? 2 : 0,
  importantCount: index >= 4 ? null : index < 3 ? 3 : 0,
  moduleStatuses: {
    http: "COMPLETED",
    html: "COMPLETED",
    runtime: index >= 3 ? "FAILED" : "COMPLETED",
    lighthouse: "COMPLETED",
  },
  failureReason:
    index === 4 ? "ANALYSIS_FAILED" : index === 5 ? "REPORT_UNAVAILABLE" : null,
  reportAvailable: index < 4,
}));
export const batch = {
  id: "700",
  domainId: "7",
  discoveryId: "600",
  hostname: "atelier.example",
  profileSnapshot: profile,
  createdAt: stamp,
  finishedAt: stamp,
  status: "PARTIAL",
  cancelRequested: false,
  counts,
  usage: { total: 6, reserved: 0, counted: 5, released: 1 },
  snapshotAt: stamp,
  version: 1,
  discovery: {
    eligiblePages: 12,
    excludedPages: 3,
    truncated: true,
    stopReason: "MAX_DEPTH",
    effectiveLimits: limits,
  },
  commonFindings: [
    {
      ruleKey: "http.hsts",
      definitionVersion: "a".repeat(64),
      category: "security",
      provenance: ["http"],
      severity: "IMPORTANT",
      titleKey: "http.hsts",
      affectedPages: 3,
      evaluatedPages: 4,
      selectedPages: 6,
      examplePageIds: ["101", "102", "103"],
      evidenceAvailable: true,
      title: "L’en-tête Strict-Transport-Security est absent",
      impact:
        "Les visiteurs peuvent être redirigés vers une connexion non chiffrée lors de leur première visite.",
      recommendation:
        "Configurer HSTS sur le serveur après avoir vérifié la disponibilité de HTTPS sur toutes les pages.",
      notEvaluatedPages: 2,
      exclusions: [
        { reason: "ANALYSIS_FAILED", pages: 1 },
        { reason: "REPORT_UNAVAILABLE", pages: 1 },
      ],
    },
    {
      ruleKey: "html.img.alt",
      definitionVersion: "b".repeat(64),
      category: "a11y",
      provenance: ["html"],
      severity: "CRITICAL",
      titleKey: "html.img.alt",
      affectedPages: 2,
      evaluatedPages: 4,
      selectedPages: 6,
      examplePageIds: ["101", "102"],
      evidenceAvailable: true,
      title: "Des images de contenu n’ont pas d’alternative textuelle",
      impact:
        "Une partie du contenu est inaccessible aux personnes utilisant un lecteur d’écran.",
      recommendation:
        "Ajouter une alternative adaptée au rôle de chaque image.",
      notEvaluatedPages: 2,
      exclusions: [],
    },
  ],
  problematicPages: pages.slice(0, 3),
  incompletePages: pages.slice(3),
};
export const discovery = {
  id: "600",
  domainId: "7",
  hostname: "atelier.example",
  status: "COMPLETED",
  createdAt: stamp,
  finishedAt: stamp,
  expiresAt: "2030-01-01T00:00:00Z",
  effectiveLimits: limits,
  eligibleCount: 6,
  excludedCount: 1,
  truncated: true,
  cancelRequested: false,
  stopReason: "MAX_DEPTH",
  version: 1,
};
export function response(path, params = new URLSearchParams()) {
  if (path === "/api/account/csrf") return { csrf: "c".repeat(43) };
  if (
    path === "/api/account/domain-discoveries" ||
    path === "/api/account/domain-batches"
  )
    return [];
  if (path === "/api/account/domain-discoveries/600") return discovery;
  if (path === "/api/account/domain-discoveries/600/pages")
    return {
      items: [
        ...pages.map((page) => ({
          pageId: page.pageId,
          normalizedUrl: page.normalizedUrl,
          source: "LINK",
          depth: 1,
          eligible: true,
          exclusionReason: null,
        })),
        {
          pageId: "199",
          normalizedUrl: "https://atelier.example/prive",
          source: "SITEMAP",
          depth: 0,
          eligible: false,
          exclusionReason: "ROBOTS_DISALLOWED",
        },
      ],
      total: 7,
      limit: 100,
      offset: 0,
    };
  if (path === "/api/account/domains")
    return {
      items:
        params.get("query") === "missing"
          ? []
          : [
              {
                id: "7",
                hostname: "atelier.example",
                latestBatchId: "700",
                latestAttemptAt: stamp,
                batchStatus: "PARTIAL",
                counts,
              },
              {
                id: "8",
                hostname: "documentation.example",
                latestBatchId: null,
                latestAttemptAt: null,
                batchStatus: null,
                counts: {
                  ...counts,
                  selectedPages: 0,
                  completePages: 0,
                  priorityPages: 0,
                  partialPages: 0,
                  failedPages: 0,
                  unknownPages: 0,
                },
              },
            ],
      total: params.get("query") === "missing" ? 0 : 2,
      limit: 20,
      offset: 0,
      snapshotAt: stamp,
    };
  if (path === "/api/account/domains/7/batches/700") return batch;
  if (path === "/api/account/domains/7/batches")
    return {
      items: [
        batch,
        {
          ...batch,
          id: "699",
          createdAt: "2026-10-10T09:00:00Z",
          status: "COMPLETED",
        },
      ],
      total: 2,
      limit: 5,
      offset: 0,
      snapshotAt: stamp,
    };
  if (path === "/api/account/domains/7/batches/700/pages") {
    let rows = pages.filter(
      (p) =>
        (!params.get("ruleKey") || Number(p.pageId) < 104) &&
        (!params.get("query") ||
          p.normalizedUrl.includes(params.get("query"))) &&
        (!params.get("status") || p.executionStatus === params.get("status")) &&
        (!params.get("completeness") ||
          p.completeness === params.get("completeness")) &&
        (params.get("scope") !== "incomplete" || p.completeness !== "FULL") &&
        (params.get("scope") !== "problematic" ||
          p.criticalCount ||
          p.importantCount),
    );
    const offset = Number(params.get("offset") ?? 0),
      limit = Number(params.get("limit") ?? 20);
    return {
      items: rows.slice(offset, offset + limit),
      total: rows.length,
      limit,
      offset,
      snapshotAt: stamp,
    };
  }
  return analysis(path, params);
}
