import { createServer } from "node:http";

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
  const partial = token === "review-partial", unavailable = token === "review-unavailable";
  const empty = token === "review-empty";
  const ratio = unavailable ? 0 : partial ? .55 : 1;
  const findings = empty ? [] : issues;
  return {
    generatedAt: "2026-10-11T10:00:00Z", domain: "atelier.example", url: "https://atelier.example/collection/sac-en-coton",
    site: { title: "Atelier · Rapport de démonstration" }, tech: { cms: { name: "Commerce démo" } },
    scores: { global: empty ? 96 : 64, globalAvailable: !unavailable, completeness: ratio * 100,
      byCategory: categories.map(c => ({ ...c, score: empty ? 96 : c.score, issues: empty ? 0 : c.issues })),
      coverage: { version: "visual-fixture", threshold: .8, provisional: partial || unavailable,
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
const tokens = new Set(["review-complete", "review-partial", "review-unavailable", "review-empty", "review-details"]);
createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.writeHead(405); res.end(JSON.stringify({ error: "Read-only visual fixtures" })); return; }
  const path = new URL(req.url, "http://127.0.0.1:3018").pathname;
  const match = path.match(/^\/api\/reports\/(review-[a-z]+)(\/status)?$/);
  if (!match) { res.writeHead(404); res.end("{}"); return; }
  const [, token, status] = match;
  if (status && (tokens.has(token) || token === "review-running" || token === "review-failed")) {
    const modules = ["http", "html", "runtime", "lighthouse", "ssl", "observatory", "zap", "tech"].map((id, n) => ({
      id, label: id, status: n < 2 ? "COMPLETED" : n === 2 ? "RUNNING" : "PENDING",
    }));
    res.end(JSON.stringify({ status: token === "review-running" ? "RUNNING" : token === "review-failed" ? "FAILED" : "COMPLETED", moduleStatuses: JSON.stringify(modules) }));
  } else if (!status && tokens.has(token)) res.end(JSON.stringify(fixture(token)));
  else { res.writeHead(404); res.end("{}"); }
}).listen(3018, "127.0.0.1", () => console.log("Visual fixtures: http://127.0.0.1:3018 (GET only)"));

