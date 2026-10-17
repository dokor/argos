import { createServer, request } from "node:http";

// Local, fictional, GET-only review. All other reads go to the existing fixture server.
process.env.ARGOS_PREVIEW_PORT ??= "3048";
await import("../../.agents/skills/argos-visual-review/scripts/preview-backend.mjs");
const port = Number(process.env.ARGOS_STATISTICS_PREVIEW_PORT ?? 3049);
const rows = [
  { key: "http.security.csp", category: "security", severity: "important", n: 108, d: 180, n30: 30, d30: 50 },
  { key: "html.meta.description.present", category: "seo", severity: "info", n: 116, d: 200, n30: 29, d30: 55 },
  { key: "html.images.alt_coverage", category: "a11y", severity: "important", n: 88, d: 200, n30: 22, d30: 55 },
  { key: "runtime.network.bytes_estimated", category: "performance", severity: "critical", n: 63, d: 180, n30: 18, d30: 50 },
  { key: "http.security.hsts", category: "security", severity: "important", n: 55, d: 220, n30: 8, d30: 60 },
];
createServer((req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/api/account/admin/problem-statistics") {
    const month = url.searchParams.get("days") === "30", category = url.searchParams.get("category");
    const findings = rows.map(row => ({ key: row.key, category: row.category, severity: row.severity,
      affectedDomains: month ? row.n30 : row.n, measuredDomains: month ? row.d30 : row.d }))
      .filter(row => row.affectedDomains >= 10 && (!category || category === row.category))
      .map(row => ({ ...row, frequency: row.affectedDomains / row.measuredDomains }))
      .sort((a, b) => b.frequency - a.frequency);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ from: month ? "2026-09-17T00:00:00Z" : "2026-07-19T00:00:00Z",
      until: "2026-10-17T00:00:00Z", generatedAt: "2026-10-17T10:00:00Z", scoringVersion: 13,
      scoringFingerprint: "70d6cf1f44bc902a1588c10001156ecd84daed448bbe3c83c119cee32f665cd0",
      coverageVersion: "weighted-coverage-v3", minimumGroupSize: 10, reports: month ? 128 : 460,
      domains: month ? 68 : 240, retainedDomains: month ? 60 : 220, partialDomains: month ? 18 : 70,
      excludedDomains: month ? 8 : 20, pendingDomains: 0, findings }));
    return;
  }
  const upstream = request({ hostname: "127.0.0.1", port: Number(process.env.ARGOS_PREVIEW_PORT), path: req.url, method: "GET" }, response => {
    res.writeHead(response.statusCode, { "Content-Type": "application/json" }); response.pipe(res);
  });
  upstream.on("error", () => { res.writeHead(503); res.end("{}"); }); upstream.end();
}).listen(port, "127.0.0.1", () => console.log(`Problem statistics fixtures: http://127.0.0.1:${port} (fictional, GET only)`));
