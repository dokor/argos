import type { Report } from "./types";
import type { Lang } from "@/lib/i18n/routes";
export function scoreLimit(report: Report, lang: Lang) {
  const coverage = report.scores.coverage;
  const names = lang === "fr" ? { performance: "performance", security: "sécurité", seo: "référencement", a11y: "accessibilité" } : { performance: "performance", security: "security", seo: "SEO", a11y: "accessibility" };
  const limited = coverage?.domains.filter(d => !d.sufficient).map(d => names[d.key as keyof typeof names] ?? d.key) ?? [];
  if (limited.length) return lang === "fr"
    ? `Le score porte sur les contrôles mesurés. Diagnostic limité en ${limited.join(", ")} : ces domaines peuvent rester provisoires même si la couverture globale est suffisante.`
    : `The score covers measured checks. Limited diagnosis in ${limited.join(", ")}: these domains can remain provisional even when overall coverage is sufficient.`;
  return lang === "fr" ? "Le score est une moyenne des contrôles mesurés ; il ne mesure ni l’urgence métier ni les contrôles absents." : "The score averages measured checks; it measures neither business urgency nor missing checks.";
}
export const interpretationCopy = {
  fr: {
    severity: "La gravité vient du contrôle source : « critique » peut qualifier un seuil d’outil ou un défaut observé. Vérifier la preuve et l’effet sur le parcours avant de décider de l’urgence.",
    actions: "L’ordre suit le modèle de score. Vérifier les preuves avant de choisir les corrections. La confiance décrit la fiabilité de la mesure ; l’effort reste à estimer sur le site.",
    accessibility: "Accessibilité : résultat automatique et limites", secondary: "Export et navigation du propriétaire", metadata: "Informations sur la mesure",
    accessibilityDetails: "Examiner les résultats d’accessibilité détaillés",
  },
  en: {
    severity: "Severity comes from the source check: “critical” may describe a tool threshold or an observed defect. Check the evidence and effect on the journey before deciding urgency.",
    actions: "The order follows the scoring model. Check evidence before choosing corrections. Confidence describes measurement reliability; effort still needs estimation on the site.",
    accessibility: "Accessibility: automated result and limitations", secondary: "Export and owner navigation", metadata: "Measurement information",
    accessibilityDetails: "Inspect detailed accessibility results",
  },
} as const;
