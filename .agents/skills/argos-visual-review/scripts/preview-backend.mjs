import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { connectedFixture } from "./connected-fixtures.mjs";
const coverage96 = JSON.parse(readFileSync(new URL("../../../../docs/report/fixtures/coverage-96.json", import.meta.url), "utf8")).coverage;

// Fictional fixtures for visual QA only. No production data and no mutation.
const categories = [
  { key: "performance", label: "Performance", score: 48, issues: 2 },
  { key: "security", label: "Sécurité", score: 63, issues: 1 },
  { key: "seo", label: "SEO", score: 82, issues: 1 },
  { key: "a11y", label: "Accessibilité", score: 72, issues: 1 },
];
const issues = [
  { id: "runtime.lcp", categoryKey: "performance", severity: "critical", title: "Le contenu principal s’affiche trop tard", impact: "Les visiteurs attendent avant de pouvoir consulter la page.", evidence: "LCP mesuré : 4,2 secondes sur ce chargement fictif.", recommendation: "Optimiser l’image principale, réduire les scripts bloquants et refaire une mesure sur la même page.", effort: "M" },
  { id: "http.security.csp", categoryKey: "security", severity: "important", title: "La politique de sécurité du contenu est absente", impact: "Le navigateur ne dispose pas de cette protection complémentaire.", evidence: "L’en-tête Content-Security-Policy n’est pas présent dans cette réponse fictive.", recommendation: "Définir une politique compatible avec les ressources du site et la tester en mode rapport.", effort: "M" },
  { id: "html.images.alt_coverage", categoryKey: "a11y", severity: "important", title: "Des images de contenu n’ont pas d’alternative textuelle", impact: "Leur information peut être inaccessible aux utilisateurs d’un lecteur d’écran.", evidence: "3 images sans attribut alt. Exemple : https://atelier.example/images/" + "produit-".repeat(30) + ".jpg", recommendation: "Décrire les images informatives ; fournir alt=\"\" aux images purement décoratives.", effort: "S" },
  { id: "html.meta.description", categoryKey: "seo", severity: "info", title: "Ajouter une description à la page produit", impact: "Une description précise aide à comprendre le contenu de la page.", evidence: "Aucune meta description détectée dans la fixture.", recommendation: "Rédiger une description spécifique qui résume le produit sans promesse de classement.", effort: "S" },
  { id: "runtime.page_weight", categoryKey: "performance", severity: "info", title: "Réduire le poids des ressources transférées sur cette page produit au titre volontairement long", impact: "Les ressources lourdes ralentissent le chargement, notamment sur une connexion mobile.", evidence: "Poids fictif : 3,8 Mo.", recommendation: "Compresser les images et supprimer les ressources inutilisées.", effort: "M" },
];
function aggregate(key, ratio = 1) {
  return { key, measuredWeight: ratio * 100, expectedWeight: 100, ratio, available: ratio > 0, sufficient: ratio >= .8 };
}
function fixture(token) {
  const coverageReview = token === "review-coverage";
  const questionsReview = token === "review-questions";
  const partial = token === "review-partial", unavailable = token === "review-unavailable";
  const empty = token === "review-empty";
  const ratio = unavailable ? 0 : coverageReview ? 215 / 223 : partial ? .55 : 1;
  const findings = empty ? [] : !(coverageReview || questionsReview) ? issues : issues.map((issue, index) => ({
    ...issue,
    id: index === 0 ? "lighthouse.audit.largest-contentful-paint" : index === 3 ? "html.meta.description.present" : index === 4 ? "runtime.network.bytes_estimated" : issue.id,
    structuredEvidence: index === 0 ? { source: "lighthouse", measurement: { value: 4200, unit: "ms" } }
      : index === 2 ? { source: "html", details: [{ key: "imgCount", text: "4" }, { key: "imgAltMissingCount", text: "2" }] } : undefined,
  }));
  if (questionsReview) findings.unshift({
    id: "lighthouse.audit.font-display-insight", categoryKey: "performance", severity: "critical",
    title: "Affichage de la police", impact: "Affichage de la police", recommendation: "", confidence: "UNKNOWN",
    structuredEvidence: { source: "lighthouse", details: [{ key: "category", text: "performance" }, { key: "score", text: "0.0" }, { key: "weight", text: "0" }],
      observed: { version: "observed-evidence-v1", source: "lighthouse", state: "AVAILABLE", inspected: 3, truncated: false, redacted: true,
        items: ["1111111111111111", "2222222222222222", "3333333333333333"].map(resourceRef => ({ kind: "resource", origin: "https://fonts.gstatic.com/", resourceRef })) },
    },
  });
  return {
    pageIdentity: { requested: "https://atelier.example/collection/sac-en-coton", destination: partial ? "https://atelier.example/collection/sac-recycle" : "https://atelier.example/collection/sac-en-coton", redacted: partial, redirected: partial },
    generatedAt: "2026-10-11T10:00:00Z", domain: "atelier.example", url: "https://atelier.example/collection/sac-en-coton",
    site: { title: "Atelier · Rapport de démonstration" }, tech: { cms: { name: "Commerce démo" }, hosting: {
      method: "HTTP_HEADERS_V1", observedAt: "2026-10-11T10:00:00Z", applicationHost: { name: "Vercel", confidence: "MEDIUM", evidence: ["x-vercel-id present"] },
      cdnProxies: [{ name: "Cloudflare", confidence: "MEDIUM", evidence: ["cf-ray present"] }], networkProvider: null, originStatus: "PROBABLE_PLATFORM",
    } },
    scores: { global: empty ? 96 : 64, globalAvailable: !unavailable, completeness: coverageReview ? 87.5 : ratio * 100,
      byCategory: categories.map(c => ({ ...c, score: empty ? 96 : c.score, issues: questionsReview ? findings.filter(i => i.categoryKey === c.key).length : empty ? 0 : c.issues })),
      coverage: coverageReview ? coverage96 : { version: "visual-fixture", threshold: .8, provisional: partial || unavailable,
        global: aggregate("global", ratio),
        domains: categories.map(c => aggregate(c.key, partial && c.key === "security" ? 0 : ratio)),
        checks: findings.map(i => ({ key: i.id, domain: i.categoryKey, module: "demo", weight: 1, state: unavailable ? "UNAVAILABLE" : "MEASURED", reason: "VISUAL_FIXTURE", confidence: "HIGH" })),
      },
    },
    summary: {
      ai: token === "review-details" ? {
        fr: { headline: "Un parcours à rendre plus rapide et plus accessible", summary: "Cette synthèse fictive sert uniquement à vérifier la présentation du rapport. Confirmez les preuves et les limites de collecte avant de choisir les corrections.", keyPoints: ["Examiner le chargement du contenu principal.", "Vérifier les alternatives des images informatives."] },
        en: { headline: "Make the journey faster and more accessible", summary: "This fictional summary only tests the report layout. Confirm the evidence and collection limits before choosing corrections.", keyPoints: ["Review the main content loading time.", "Check alternatives for informative images."] },
      } : null,
      oneLiner: empty ? "high" : "fair",
      priorities: findings.map((i, n) => ({ severity: i.severity === "info" ? "opportunity" : i.severity,
        title: i.title, impact: i.impact, categoryKey: i.categoryKey, findingKey: i.id, effort: i.effort,
        rank: n + 1, rankReason: unavailable ? "SCORE_UNAVAILABLE" : "MODELLED_SCORE_GAIN", globalScoreGain: 4.5 - n * .5, confidence: "HIGH",
      })),
    },
    issues: findings,
    antiBot: partial ? { detected: true, vendor: "protection de démonstration" } : null,
    ...(token === "review-details" ? {
      accessibilityCompliance: {
        accessibilityComplianceVersion: "visual-fixture", rulesValidated: false,
        scopes: ["POTENTIALLY_EAA", "UNKNOWN"], confidence: "LOW", risk: "UNKNOWN", riskReason: "RULES_PENDING",
        signals: [{ code: "PRICE", provenance: "OBSERVED", value: true }],
        missingInformation: ["ENTERPRISE_SIZE", "RULES_REVIEW"], references: [],
      },
    } : {}),
    accessibilityEvidence: {
      version: "visual-fixture", mappingVersion: "visual-fixture", sourceVersion: "demo",
      lighthouseScore: unavailable ? null : 72,
      coverage: unavailable ? "UNAVAILABLE" : partial ? "PARTIAL" : "COMPLETE",
      referencedAudits: 8, statusCounts: { FAIL: empty ? 0 : 1, PASS: empty ? 6 : 5, MANUAL: 2 },
      failedAudits: empty ? 0 : 1, reportedElements: empty ? 0 : 3, elementCountComplete: true,
      surfacedFindings: empty ? 0 : 1, truncated: false,
      findings: empty || unavailable ? [] : [{ id: "lighthouse.audit.image-alt", source: "lighthouse",
        kind: "IMAGE_ALTERNATIVE", severity: "HIGH", score: 0, reportedElements: 3, wcagCriteria: ["1.1.1"] }],
    },
  };
}
const tokens = new Set(["review-complete", "review-partial", "review-unavailable", "review-empty", "review-details", "review-coverage", "review-questions"]);
const port = Number(process.env.ARGOS_PREVIEW_PORT ?? 3018);
createServer((req, res) => {
  if (req.method === "GET" && req.url?.startsWith("/api/account/admin/statistics")) {
    const period = new URL(req.url, "http://localhost").searchParams.get("period") ?? "all";
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ generatedAt: "2026-10-17T10:00:00Z", period,
      from: period === "all" ? null : new Date(Date.parse("2026-10-17T10:00:00Z") - Number(period) * 86400000).toISOString(),
      accounts: { created: 1250, validated: 900, suspended: 12, archived: 48, validationUnknown: 48, google: 610, github: 300, linkedin: 120 },
      analyses: { total: 2430, completed: 2100, failed: 130, running: 20, queued: 80, canceled: 70, unknown: 30 },
      domains: { total: 810, averageUrls: 3 } }));
  }
  if (req.method === "GET" && req.url === "/api/audits/scope-catalogue") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ version: "visual-fixture", checkKeys: ["http.security.csp", "html.images.alt_coverage"] }));
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.writeHead(405); res.end(JSON.stringify({ error: "Read-only visual fixtures" })); return; }
  const path = new URL(req.url, "http://127.0.0.1:3018").pathname;
  const params = new URL(req.url, "http://127.0.0.1:3018").searchParams;
  const send = data => res.end(JSON.stringify(data));
  if (path === "/api/antibot") return send({enabled:false});
  const usage = { offer: "DEMO", period: "2026-10", timezone: "UTC", startsAt: "2026-10-01T00:00:00Z", resetsAt: "2026-11-01T00:00:00Z", used: 12, reserved: 2, limit: 50, canLaunch: true };
  // Account roles below are fictional fixture responses, never production access.
  if (path === "/api/account/me") return send({ displayName: "Administration démo", email: "admin@atelier.example", verified: true, admin: true });
  if (path === "/api/account/usage") return send({ ...usage, available: 36 });
  if (path === "/api/account/domain-discoveries/limits") return send({ maxUrls: 50, maxDepth: 3, defaultUrls: 20, defaultDepth: 2, durationSeconds: 60 });
  const connected = connectedFixture(path, params, fixture, { ...usage, available: 36 });
  if (connected !== undefined) return send(connected);
  if (path === "/api/account/admin/queue") return send({ queued: 3, running: 2 });
  const users = [{ id: "101", displayName: "Camille · Atelier de démonstration au nom volontairement long", email: "contact-avec-une-adresse-volontairement-longue@atelier.example", state: "ACTIVE", role: "USER", offer: "DEMO", createdAt: "2026-10-11T10:00:00Z" }, { id: "102", displayName: "Morgan", email: "morgan@atelier.example", state: "ARCHIVED", role: "USER", offer: "DEMO", createdAt: "2026-10-10T09:00:00Z" }];
  if (path === "/api/account/admin/analytics/settings") return send({ enabled: false, requestedEnabled: false, deploymentAllowed: false, version: 0, lastCollectedAt: "2026-10-11T10:00:00Z" });
  if (path === "/api/account/admin/run-options") return send({ items: params.get("kind") === "site" ? [{ id: "1", site: "atelier.example" }] : users.filter(u => u.state !== "ARCHIVED" && (!params.get("q") || (u.displayName+u.email).toLowerCase().includes(params.get("q").toLowerCase()))), nextCursor: null });
  if (path === "/api/account/admin/users") return send({ items: users.filter(u => (!params.get("q") || (u.displayName+u.email).toLowerCase().includes(params.get("q").toLowerCase())) && (!params.get("state") || u.state === params.get("state"))), nextCursor: null });
  const userMatch = path.match(/^\/api\/account\/admin\/users\/(101|102)$/);
  if (userMatch) return send({ ...users.find(u => u.id === userMatch[1]), usage, monthlyLimit: null, offers: ["DEMO", "STANDARD"] });
  const runs = ["COMPLETED", "FAILED", "RUNNING", "QUEUED"].map((status,i) => ({ id: String(401-i), userId: i%2 ? null : "101", site: "atelier.example", displayUrl: "https://atelier.example/" + (i ? "page-" + i : "collection/sac-en-coton"), resolvedUserId: i%2 ? null : "101", userDisplayName: i%2 ? null : users[0].displayName, userEmail: i%2 ? null : users[0].email, status, createdAt: "2026-10-11T10:00:00Z", reportAvailable: status === "COMPLETED", modules: { http: "COMPLETED", html: "COMPLETED", runtime: status === "FAILED" ? "FAILED" : status === "COMPLETED" ? "COMPLETED" : "RUNNING", lighthouse: status === "COMPLETED" ? "COMPLETED" : "PENDING" }, failureCode: status === "FAILED" ? "VISUAL_FIXTURE" : null, attempts: 1 }));
  if (path === "/api/account/admin/runs") return send({ items: runs.filter(r => (!params.get("status") || r.status === params.get("status")) && (!params.get("site") || r.site === params.get("site"))), nextCursor: null });
  const runMatch = path.match(/^\/api\/account\/admin\/runs\/(\d+)(\/report)?$/);
  if (runMatch) return send(runMatch[2] ? fixture("review-details") : runs.find(r => r.id === runMatch[1]) ?? runs[0]);
  if (path === "/api/account/admin/events") return send({ items: [{ id: "1", actorId: "900", targetId: "101", oldOffer: "DEMO", newOffer: "STANDARD", oldLimit: null, newLimit: 100, createdAt: "2026-10-11T10:00:00Z" }], nextCursor: null });
  const feedback = [{ id: "701", type: "BUG", status: "OPEN", createdAt: "2026-10-11T10:00:00Z", updatedAt: "2026-10-11T10:00:00Z" }];
  if (path === "/api/account/admin/feedback") return send({ items: feedback.filter(f => (!params.get("status") || f.status === params.get("status")) && (!params.get("type") || f.type === params.get("type"))), nextCursor: null });
  if (path === "/api/account/admin/feedback/701") return send({ ...feedback[0], description: "Texte fictif très long pour vérifier les retours et la lecture des détails. ".repeat(12), page: "REPORT", expected: "Des boutons alignés et de même hauteur.", observed: "Le libellé revient à la ligne.", steps: "Ouvrir le rapport sur un écran étroit.", runId: "401", findingKey: "html.images.alt_coverage", events: [] });
  if (path === "/api/account/admin/analytics") {
    const counts = { accepted: 24, started: 22, completed: 18, failed: 2, pending: 4, viewed: 15, completedViewed: 14 };
    const delay = { sample: 18, excluded: 0, medianMs: 19000, p90Ms: 28000, p95Ms: 32000 };
    const days = [7,30,90].includes(Number(params.get("days"))) ? Number(params.get("days")) : 30;
    const until = "2026-10-17T12:00:00Z", from = new Date(Date.parse(until) - days * 86400000).toISOString();
    return send({ accounts: { activeAccounts: 12, returningAccounts: 4, activityDays: 17, authentications: 14, claimedReports: 3, cohorts: [{ method: "password", lang: "fr", registered: 10, activated: 5, claimed: 2, day7: { eligible: days > 7 ? 8 : 0, returned: days > 7 ? 2 : 0 }, day30: { eligible: days > 30 ? 4 : 0, returned: days > 30 ? 1 : 0 } }, { method: "github", lang: "en", registered: 4, activated: 2, claimed: 1, day7: { eligible: 0, returned: 0 }, day30: { eligible: 0, returned: 0 } }] }, byAudience: [{ audience: "visitor", counts: { accepted: 14, started: 13, completed: 10, failed: 1, pending: 3, viewed: 8, completedViewed: 8 } }, { audience: "account", counts: { accepted: 10, started: 9, completed: 8, failed: 1, pending: 1, viewed: 7, completedViewed: 6 } }, { audience: "unknown", counts: { accepted: 0, started: 0, completed: 0, failed: 0, pending: 0, viewed: 0, completedViewed: 0 } }], enabled: false, capped: false, from, until, cohort: counts, bySource: [{ route: "/ressources/audit-technique-gratuit", lang: "fr", placement: "hero", counts }], queue: { ...delay, medianMs: 2000 }, processing: delay, endToEnd: delay, events: [{ event: "audit_cta_click", route: "/", lang: "fr", placement: "hero", error: "", count: 24 }] });
  }
  const match = path.match(/^\/api\/reports\/(review-[a-z]+)(?:-fixture)?(\/status)?$/);
  if (!match) { res.writeHead(404); res.end("{}"); return; }
  const [, token, status] = match;
  if (status && (tokens.has(token) || token === "review-running" || token === "review-finalizing" || token === "review-failed")) {
    const modules = ["http", "html", "runtime", "lighthouse", "ssl", "observatory", "zap", "tech"].map((id, n) => ({
      id, label: id, status: token === "review-finalizing" ? (n === 6 ? "SKIPPED" : "COMPLETED") : n < 2 ? "COMPLETED" : n === 2 ? "RUNNING" : "PENDING",
    }));
    res.end(JSON.stringify({ status: token === "review-running" || token === "review-finalizing" ? "RUNNING" : token === "review-failed" ? "FAILED" : "COMPLETED", moduleStatuses: JSON.stringify(modules) }));
  } else if (!status && tokens.has(token)) res.end(JSON.stringify(fixture(token)));
  else { res.writeHead(404); res.end("{}"); }
}).listen(port, "127.0.0.1", () => console.log(`Visual fixtures: http://127.0.0.1:${port} (GET only)`));
