import type { Issue } from "./types";
import type { Lang } from "@/lib/i18n/routes";

export function isAggregateFinding(key?: string | null) {
  return !!key && (key.startsWith("lighthouse.score.") || key === "ssl.grade" || key === "observatory.score");
}
export function findingQualification(issue: Issue, lang: Lang) {
  if (isAggregateFinding(issue.id)) return lang === "fr" ? "Diagnostic agrégé d’outil" : "Aggregate tool diagnosis";
  // Reliability does not confirm business urgency. Tool diagnostics still need reproduction.
  if (issue.id?.startsWith("lighthouse.") || !["HIGH", "MEDIUM"].includes(issue.confidence ?? ""))
    return lang === "fr" ? "Signal à vérifier sur le parcours" : "Signal to verify in the journey";
  return lang === "fr" ? "Observation de mesure documentée" : "Documented measurement observation";
}
const subjects: Record<string, [string, string]> = {
  "html.title": ["Titre HTML de la page", "Page HTML title"],
  "html.meta.description.present": ["Description dans le HTML reçu", "Description in the received HTML"],
  "html.h1.count": ["Titres h1 dans le document", "h1 headings in the document"],
  "html.social.meta": ["Métadonnées de partage", "Sharing metadata"],
  "runtime.network.5xx": ["Réponses serveur 5xx observées", "Observed 5xx server responses"],
  "runtime.network.failed_requests": ["Requêtes en échec observées", "Observed failed requests"],
  "runtime.network.third_party_errors": ["Incidents de fournisseurs tiers observés", "Observed third-party incidents"],
  "runtime.console.errors": ["Erreurs de console observées", "Observed console errors"],
  "runtime.js.errors": ["Erreurs JavaScript observées", "Observed JavaScript errors"],
};
export function describeObservation(issue: Issue, title: string, lang: Lang) {
  const fr = lang === "fr";
  const details = issue.structuredEvidence?.details ?? [];
  const detail = (key: string) => details.find(d => d.key === key)?.text;
  const count = (key: string) => { const text = detail(key); return text !== undefined && /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : undefined; };
  if (issue.id === "html.title" && count("length") !== undefined)
    return fr ? `Le titre HTML contient ${count("length")} caractères.` : `The HTML title contains ${count("length")} characters.`;
  if (issue.id === "html.h1.count" && count("h1Count") !== undefined)
    return fr ? `${count("h1Count")} titre(s) h1 ont été trouvés dans le document.` : `${count("h1Count")} h1 heading(s) were found in the document.`;
  const states: Record<string, [string, string]> = {
    ABSENT: ["élément absent", "element absent"], ATTRIBUTE_MISSING: ["attribut attendu absent", "expected attribute absent"],
    EMPTY: ["valeur vide", "empty value"], INVALID: ["valeur invalide", "invalid value"], PRESENT: ["valeur présente", "value present"],
  };
  if (issue.id?.startsWith("html.") && states[detail("state") ?? ""])
    return `${subjects[issue.id]?.[fr ? 0 : 1] ?? title} : ${states[detail("state")!][fr ? 0 : 1]}.`;
  if (issue.id === "html.images.alt_coverage" && count("missingAltCount") !== undefined && count("imgCount") !== undefined)
    return fr ? `${count("missingAltCount")} image(s) sans attribut alt parmi ${count("imgCount")} images observées.` : `${count("missingAltCount")} image(s) without an alt attribute among ${count("imgCount")} observed images.`;
  const subject = subjects[issue.id ?? ""]?.[fr ? 0 : 1] ?? title;
  const measure = issue.structuredEvidence?.measurement;
  const units = { ms: "ms", bytes: fr ? "octets" : "bytes", count: fr ? "élément(s)" : "item(s)", days: fr ? "jours" : "days", "score/100": "/100", ratio: "ratio", unitless: fr ? "sans unité" : "unitless" };
  const value = measure && Number.isFinite(measure.value) && Object.hasOwn(units, measure.unit)
    ? `${measure.value.toLocaleString(lang, { maximumSignificantDigits: 6 })} ${units[measure.unit]}` : undefined;
  return `${subject} — ${value ?? (issue.evidence || issue.structuredEvidence?.details?.length
    ? (fr ? "preuve conservée ci-dessous." : "evidence retained below.")
    : (fr ? "mesure détaillée non conservée." : "detailed measurement not retained."))}`;
}
export function missingLocation(issue: Issue, lang: Lang) {
  if (issue.id === "html.title" || issue.id === "html.meta.description.present" || issue.id === "html.social.meta")
    return lang === "fr" ? "Emplacement : <head> de la page mesurée. Utiliser le HTML reçu pour retrouver la balise et sa valeur exacte." : "Location: <head> of the measured page. Use the received HTML to locate the tag and its exact value.";
  const located = issue.structuredEvidence?.details?.some(d => /url|element|node|selector|resource|sample|snippet|location/i.test(d.key)) || /<\w|https?:\/\//.test(issue.evidence ?? "");
  return located ? "" : lang === "fr"
    ? "Le rapport ne conserve pas les éléments ou ressources concernés ni leur emplacement. Les retrouver dans le HTML ou le diagnostic source avant d’agir."
    : "The report does not retain the affected elements or resources and their location. Locate them in the HTML or source diagnosis before acting.";
}
