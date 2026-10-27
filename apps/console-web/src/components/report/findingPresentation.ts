import type { Issue } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import { headerTargets, documentTargets, pageTargets, isPageTiming } from './findingTargets';

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
  const observed = issue.structuredEvidence?.observed;
  if (observed?.source === "lighthouse" && observed.items.length) {
    const resourceCount = new Set(observed.items.filter(item => item.kind === "resource").map(item => `${item.origin}:${item.resourceRef}`)).size;
    const elementCount = new Set(observed.items.filter(item => item.kind === "element").map(item => item.nodePath ?? item.selector)).size;
    if (issue.id === "lighthouse.audit.font-display-insight" && resourceCount) return fr
      ? `Lighthouse signale ${resourceCount} fichier(s) de police dont le chargement peut masquer temporairement le texte. Les ressources conservées dans cet échantillon sont listées ci-dessous.`
      : `Lighthouse flags ${resourceCount} font file(s) whose loading may temporarily hide text. The resources retained in this sample are listed below.`;
    if (issue.id === "lighthouse.audit.image-delivery-insight" && resourceCount) return fr
      ? `Lighthouse signale ${resourceCount} image(s) dont le poids pourrait être réduit. Comparez le poids téléchargé et l’économie estimée pour chaque fichier ci-dessous.`
      : `Lighthouse flags ${resourceCount} image(s) whose size could be reduced. Compare the downloaded size and estimated savings for each file below.`;
    if (issue.id === "lighthouse.audit.image-alt" && elementCount) return fr
      ? `Lighthouse signale ${elementCount} élément(s) image sans alternative accessible. Retrouvez-les avec les sélecteurs ci-dessous et vérifiez leur fonction dans la page.`
      : `Lighthouse flags ${elementCount} image element(s) without an accessible alternative. Locate them using the selectors below and check their purpose on the page.`;
    if (elementCount || resourceCount) {
      const sample = [elementCount ? `${elementCount} ${fr ? 'élément(s)' : 'element(s)'}` : '', resourceCount ? `${resourceCount} ${fr ? 'ressource(s)' : 'resource(s)'}` : ''].filter(Boolean).join(fr ? ' et ' : ' and ');
      return fr ? `Lighthouse associe ce signal à ${sample} dans l’échantillon conservé. Les emplacements observés sont détaillés ci-dessous.`
        : `Lighthouse associates this signal with ${sample} in the retained sample. Observed locations are detailed below.`;
    }
  }
  const details = issue.structuredEvidence?.details ?? [];
  const detail = (key: string) => details.find(d => d.key === key)?.text;
  const count = (key: string) => { const text = detail(key); return text !== undefined && /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : undefined; };
  if (detail('present') === 'false' && headerTargets[issue.id??'']) return fr
    ? `L’en-tête ${headerTargets[issue.id!]} est absent ou vide dans la réponse examinée.`
    : `The ${headerTargets[issue.id!]} header is absent or empty in the inspected response.`;
  if (detail('present') === 'false' && documentTargets[issue.id??'']) return fr
    ? `La déclaration attendue à cet emplacement est absente : ${documentTargets[issue.id!]}.`
    : `The expected declaration is absent at this location: ${documentTargets[issue.id!]}.`;
  if (issue.id === "html.title" && count("length") !== undefined)
    return fr ? `Le titre HTML contient ${count("length")} caractères.` : `The HTML title contains ${count("length")} characters.`;
  if (issue.id === "html.h1.count" && count("h1Count") !== undefined)
    return fr ? `${count("h1Count")} titre(s) h1 ont été trouvés dans le document.` : `${count("h1Count")} h1 heading(s) were found in the document.`;
  const states: Record<string, [string, string]> = {
    ABSENT: ["élément absent", "element absent"], ATTRIBUTE_MISSING: ["attribut attendu absent", "expected attribute absent"],
    EMPTY: ["valeur vide", "empty value"], INVALID: ["valeur invalide", "invalid value"], PRESENT: ["valeur présente", "value present"], USABLE: ["valeur exploitable", "usable value"],
  };
  if (issue.id?.startsWith("html.") && states[detail("state") ?? ""])
    return `${subjects[issue.id]?.[fr ? 0 : 1] ?? title} : ${states[detail("state")!][fr ? 0 : 1]}.`;
  const missingAlt = count("imgAltMissingCount") ?? count("missingAltCount");
  if (issue.id === "html.images.alt_coverage" && missingAlt !== undefined && count("imgCount") !== undefined)
    return fr ? `${missingAlt} image(s) sans attribut alt parmi ${count("imgCount")} images observées.` : `${missingAlt} image(s) without an alt attribute among ${count("imgCount")} observed images.`;
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
  if (issue.id?.startsWith('lighthouse.score.')) return lang === 'fr'
    ? 'Ce score résume plusieurs contrôles de cette page. Traiter les constats Lighthouse détaillés du même domaine ; le score seul ne désigne aucun élément à modifier.'
    : 'This score summarises several checks on this page. Address the detailed Lighthouse findings in the same category; the score alone identifies no element to change.';
  if (Object.hasOwn(headerTargets,issue.id??'') || Object.hasOwn(documentTargets,issue.id??'') || Object.hasOwn(pageTargets,issue.id??'') || isPageTiming(issue.id) || issue.id==='lighthouse.audit.robots-txt') return '';
  if (issue.structuredEvidence?.details?.some(d=>['responseHeader','responseBodyLine','probePath','exposed'].includes(d.key)&&d.text)) return '';
  if (['zap.alert.10055','zap.alert.10037'].includes(issue.id ?? '')) return '';
  if (issue.id?.startsWith('ssl.') && issue.structuredEvidence?.details?.some(d => d.key === 'selectedEndpoint' && d.text)) return '';
  if (issue.id?.startsWith('ssl.')) return lang === 'fr'
    ? 'À examiner : le certificat et la configuration TLS des serveurs ou du CDN qui répondent pour le domaine audité. Retrouver la terminaison concernée dans le diagnostic SSL Labs.'
    : 'Inspect the certificate and TLS configuration of the servers or CDN responding for the audited domain. Locate the affected endpoint in the SSL Labs diagnosis.';
  if (issue.id === 'observatory.score') return lang === 'fr'
    ? 'À examiner : les en-têtes et politiques de la réponse HTTP analysée par Observatory. Vérifier l’adresse et la date du diagnostic source avant de comparer les réponses.'
    : 'Inspect the headers and policies of the HTTP response analysed by Observatory. Check the source diagnosis address and date before comparing responses.';
  if (issue.id?.startsWith('zap.alert.')) return lang === 'fr'
    ? 'À examiner : les en-têtes ou le contenu de la réponse HTTP collectée par ZAP. Si son adresse précise manque, retrouver l’alerte dans le diagnostic source ; l’analyse passive ne couvre pas tout le site.'
    : 'Inspect the headers or content of the HTTP response collected by ZAP. If its exact address is missing, locate the alert in the source diagnosis; passive analysis does not cover the whole site.';
  if (issue.id === 'tech.security.version_disclosure') return lang === 'fr'
    ? 'À examiner : les bannières de la réponse HTTP et les mentions de version dans le HTML reçu. Le composant réellement installé doit être vérifié dans son administration.'
    : 'Inspect HTTP response banners and version mentions in received HTML. Verify the actually installed component in its administration interface.';
  if (issue.id === "html.title" || issue.id === "html.meta.description.present" || issue.id === "html.social.meta")
    return lang === "fr" ? "Emplacement : <head> de la page mesurée. Utiliser le HTML reçu pour retrouver la balise et sa valeur exacte." : "Location: <head> of the measured page. Use the received HTML to locate the tag and its exact value.";
  if (issue.structuredEvidence?.observed?.version === "observed-evidence-v1") return ""; // Collection metadata explains its own availability and limits.
  const located = issue.structuredEvidence?.details?.some(d => /url|element|node|selector|resource|sample|snippet|location/i.test(d.key)) || /<\w|https?:\/\//.test(issue.evidence ?? "");
  return located ? "" : lang === "fr"
    ? "Le rapport ne conserve pas les éléments ou ressources concernés ni leur emplacement. Les retrouver dans le HTML ou le diagnostic source avant d’agir."
    : "The report does not retain the affected elements or resources and their location. Locate them in the HTML or source diagnosis before acting.";
}
