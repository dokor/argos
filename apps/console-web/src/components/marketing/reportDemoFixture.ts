import { localizeValue } from "@/lib/i18n/messages";
import type { Report, Issue, CoverageAggregate } from "@/components/report/types";
import type { Lang } from "@/lib/i18n/routes";

export const DEMO_VERSION = "illustrative-report-v2";
export const DEMO_DATE = "2026-10-10T00:00:00Z";
export function demoReport(lang: Lang, partial = false): Report {
  const issues: Issue[] = [
    { id: "html.meta.description.present", categoryKey: "seo", module: "html", severity: "important", title: (lang === "fr" ? "Description absente" : localizeValue("Missing description", lang)), impact: (lang === "fr" ? "La page ne propose aucun résumé aux moteurs." : localizeValue("The page provides no summary for search engines.", lang)), evidence: '<head>…<!-- no meta name="description" -->…</head>', recommendation: (lang === "fr" ? "Rédiger une description spécifique à la fiche produit." : localizeValue("Write a description specific to the product page.", lang)), effort: "S", confidence: "HIGH" },
    { id: "html.images.alt_coverage", categoryKey: "a11y", module: "html", severity: "important", title: (lang === "fr" ? "Image informative sans alternative" : localizeValue("Informative image without alternative text", lang)), impact: (lang === "fr" ? "Le contenu visuel peut manquer aux lecteurs d’écran." : localizeValue("Screen reader users may miss the visual information.", lang)), evidence: '<img src="/demo/atelier/sac.svg" width="320" height="240">', recommendation: (lang === "fr" ? "Ajouter une alternative décrivant le sac." : localizeValue("Add alternative text describing the bag.", lang)), effort: "S", confidence: "HIGH" },
    { id: "html.title", categoryKey: "seo", module: "html", severity: "info", title: (lang === "fr" ? "Titre très court" : localizeValue("Very short title", lang)), impact: (lang === "fr" ? "Le titre Sac donne peu de contexte." : localizeValue("The title Sac provides little context.", lang)), evidence: "<title>Sac</title>", recommendation: (lang === "fr" ? "Décrire le produit et la boutique dans le titre." : localizeValue("Describe the product and store in the title.", lang)), effort: "S", confidence: "HIGH" },
  ];
  const domains = ["performance", "security", "seo", "a11y"];
  const aggregate = (key: string): CoverageAggregate => ({ key, measuredWeight: partial ? 1 : 2, expectedWeight: 2, ratio: partial ? 0.5 : 1, available: true, sufficient: !partial });
  return {
    measurements: {lcpMs:partial?null:4200,fcpMs:null,responseMs:320,loadMs:partial?null:5200,transferredBytes:3800000,requests:62,htmlBytes:48000,scripts:14,jsErrors:2,consoleErrors:3,failedRequests:1,http4xx:null,http5xx:0},
    pageIdentity: { requested: "https://atelier.example/produit/sac", destination: "https://atelier.example/produit/sac", redacted: false, redirected: false },
    generatedAt: DEMO_DATE, domain: "Atelier Démo", url: "https://atelier.example/produit/sac", site: { title: "Atelier Démo — illustration" },
    scores: { global: 75, globalAvailable: true, completeness: partial ? 50 : 100,
      coverage: { version: DEMO_VERSION, threshold: 0.8, provisional: partial, global: aggregate("global"), domains: domains.map(aggregate),
        checks: domains.flatMap(domain => [
          { key: `illustration.${domain}.1`, domain, module: domain === "security" ? "http" : "html", weight: 1, state: "MEASURED" as const, reason: "ILLUSTRATIVE_NOT_MEASURED", confidence: "UNKNOWN" },
          { key: `illustration.${domain}.2`, domain, module: "lighthouse", weight: 1, state: partial ? "UNAVAILABLE" as const : "MEASURED" as const, reason: "ILLUSTRATIVE_NOT_MEASURED", confidence: "UNKNOWN" },
        ]) },
      byCategory: domains.map(key => ({ key, label: key, score: 75, issues: issues.filter(issue => issue.categoryKey === key).length })),
    },
    summary: { oneLiner: "good", priorities: issues.map((issue, index) => ({ severity: issue.severity === "info" ? "opportunity" : issue.severity, title: issue.title, impact: issue.impact, effort: issue.effort, findingKey: issue.id, categoryKey: issue.categoryKey, rank: index + 1, rankingVersion: DEMO_VERSION, confidence: "HIGH" })) },
    issues,
  };
}
