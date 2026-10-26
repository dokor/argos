import type { Issue } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import { describeObservation, findingQualification, missingLocation } from "./findingPresentation";
import { findingPlaybook } from "./findingPlaybooks";
import { findingExplanation } from "./findingExplanation";
import { detailedRuleGuidance } from "./findingRuleGuidance";
import { cleanEvidence } from './findingText';
export { cleanEvidence } from './findingText';

export const CATALOGUE_VERSION = "report-content-v9";
export type FindingContent = { title: string; observation: string; impact: string; recommendation: string; verification: string; qualification: string; missingInformation: string };
type Copy = [title: string, impact: string];
const catalogue: Record<string, Record<Lang, Copy>> = {};
function add(keys: string[], fr: Copy, en: Copy) { for (const key of keys) catalogue[key] = { fr: [...fr], en: [...en] }; }

add(["lighthouse.audit.font-display-insight"],
  ["Affichage des polices à vérifier", "Attendre une police distante peut retarder la lecture ; son remplacement peut déplacer le texte. Vérifier ces effets sur la page."],
  ["Review font display", "Waiting for a remote font can delay reading; replacing it can move text. Check these effects on the page."]);

add(["lighthouse.audit.largest-contentful-paint"],
  ["L’affichage du contenu principal est à examiner", "Une attente prolongée peut retarder la lecture de la page."],
  ["Review when the main content appears", "A long wait can delay reading the page."]);
add(["lighthouse.audit.total-blocking-time", "lighthouse.audit.interactive"],
  ["Le travail du navigateur au chargement est à examiner", "Les tâches longues peuvent retarder les premières interactions."],
  ["Review browser work during loading", "Long tasks may delay early interactions."]);
add(["lighthouse.audit.first-contentful-paint", "lighthouse.audit.speed-index"],
  ["L’apparition des premiers contenus est à examiner", "Le visiteur peut attendre avant de percevoir une page utile."],
  ["Review when initial content appears", "Visitors may wait before seeing a useful page."]);
add(["lighthouse.audit.cumulative-layout-shift"],
  ["La stabilité visuelle est à examiner", "Les déplacements du contenu peuvent gêner la lecture et les clics."],
  ["Review visual stability", "Moving content can disrupt reading and clicking."]);
add(["lighthouse.audit.unused-javascript", "lighthouse.audit.unused-css", "lighthouse.audit.render-blocking-resources"],
  ["Des ressources chargées méritent une revue", "Du code non essentiel peut augmenter le transfert et le travail du navigateur."],
  ["Review loaded resources", "Non-essential code can increase transfer size and browser work."]);
add(["lighthouse.audit.image-delivery", "lighthouse.audit.modern-image-formats", "lighthouse.audit.uses-optimized-images", "lighthouse.audit.uses-responsive-images", "lighthouse.audit.unsized-images"],
  ["Le chargement des images est à examiner", "Des ressources inadaptées peuvent ralentir l’affichage ou déplacer le contenu."],
  ["Review image loading", "Unsuitable resources can delay rendering or shift content."]);
add(["http.security.hsts", "ssl.hsts"],
  ["La politique HTTPS du navigateur est à vérifier", "Une politique absente ou inadaptée peut laisser des navigations en HTTP."],
  ["Review the browser HTTPS policy", "A missing or unsuitable policy may allow HTTP navigation."]);
add(["http.security.csp"],
  ["La politique de chargement des contenus est à vérifier", "Une politique explicite peut limiter les ressources exécutées dans le navigateur."],
  ["Review the content loading policy", "An explicit policy can restrict resources executed in the browser."]);
add(["http.security.x_frame_options"],
  ["L’intégration de la page dans un cadre est à vérifier", "Une intégration non maîtrisée peut exposer les interactions à un détournement."],
  ["Review page framing permissions", "Uncontrolled embedding may expose interactions to misuse."]);
add(["http.security.x_content_type_options", "http.headers.content_type"],
  ["Le type des ressources est à vérifier", "Un type incorrect peut perturber l’interprétation des ressources."],
  ["Review resource content types", "Incorrect types may disrupt resource interpretation."]);
add(["http.security.referrer_policy"],
  ["La transmission du référent est à vérifier", "La navigation peut transmettre des informations sur la page d’origine."],
  ["Review referrer information sharing", "Navigation may disclose information about the originating page."]);
add(["http.security.permissions_policy"],
  ["Les permissions du navigateur sont à préciser", "Des fonctionnalités sensibles peuvent être accessibles aux contenus intégrés."],
  ["Review browser permissions", "Embedded content may access sensitive capabilities."]);
add(["http.security.cookie_flags"],
  ["Les protections des cookies sont à vérifier", "Des attributs inadaptés peuvent exposer les cookies à des usages indésirables."],
  ["Review cookie protections", "Unsuitable attributes may expose cookies to unintended use."]);
add(["http.final_url.https", "http.redirect.to_https"],
  ["Le parcours vers HTTPS est à vérifier", "Une connexion HTTP peut exposer les données en transit."],
  ["Review the HTTPS navigation path", "HTTP connections can expose data in transit."]);
add(["http.status_code", "http.errors", "runtime.network.5xx", "runtime.network.failed_requests", "runtime.network.third_party_errors"],
  ["Des réponses réseau sont à examiner", "Des ressources indisponibles peuvent interrompre le parcours observé."],
  ["Review network responses", "Unavailable resources may interrupt the observed journey."]);
add(["runtime.console.errors", "runtime.js.errors"],
  ["Des erreurs de scripts sont à examiner", "Une erreur peut empêcher certaines fonctions de la page."],
  ["Review script errors", "An error may prevent some page functions from working."]);
add(["http.response_time_ms", "http.redirect.count", "http.protocol.version", "http.protocol.http2", "http.headers.compression", "http.headers.caching", "http.headers.server", "runtime.network.request_count", "runtime.network.bytes_estimated", "runtime.analysis.duration_ms"],
  ["Le coût du chargement est à examiner", "Le transfert et les échanges réseau peuvent allonger l’attente selon la connexion."],
  ["Review loading overhead", "Transfers and network exchanges may increase waiting time depending on the connection."]);
add(["http.antibot.challenge"],
  ["Une protection limite l’observation", "Le contenu mesuré peut être une page de vérification plutôt que le site attendu."],
  ["A protection limits observation", "Measured content may be a challenge page rather than the intended site."]);
add(["html.title", "html.meta.description.present", "html.h1.count", "html.social.meta"],
  ["La présentation du contenu est à préciser", "Des métadonnées incomplètes peuvent rendre le contenu moins compréhensible dans les aperçus."],
  ["Clarify how content is presented", "Incomplete metadata may make content harder to understand in previews."]);
add(["html.link.canonical.present", "html.meta.robots.present", "http.seo.robots_txt", "http.seo.sitemap"],
  ["Les indications aux moteurs sont à vérifier", "Des indications incohérentes peuvent gêner la découverte des pages attendues."],
  ["Review search engine directives", "Inconsistent directives can hinder discovery of intended pages."]);
add(["html.meta.viewport.present", "html.doctype.html5", "html.meta.charset.present", "html.lang", "lighthouse.audit.html-has-lang", "lighthouse.audit.html-lang-valid"],
  ["Le contexte du document est à vérifier", "Une déclaration inadaptée peut gêner l’affichage ou les technologies d’assistance."],
  ["Review document context", "Unsuitable declarations can hinder rendering or assistive technology."]);
add(["html.images.alt_coverage", "lighthouse.audit.image-alt"],
  ["Les alternatives des images sont à vérifier", "Une image informative sans alternative peut perdre son sens en lecture assistée."],
  ["Review image alternatives", "Informative images without alternatives may lose their meaning in assisted reading."]);
add(["html.anchors.href_coverage", "lighthouse.audit.button-name", "lighthouse.audit.link-name", "lighthouse.audit.label", "lighthouse.audit.input-button-name", "lighthouse.audit.select-name"],
  ["La fonction des contrôles est à clarifier", "Un contrôle sans nom ou destination peut être difficile à comprendre ou à utiliser."],
  ["Clarify control functions", "Controls without a name or destination can be difficult to understand or use."]);
add(["lighthouse.audit.color-contrast"],
  ["La lisibilité des couleurs est à vérifier", "Un contraste insuffisant peut rendre le texte difficile à lire."],
  ["Review colour readability", "Insufficient contrast may make text hard to read."]);
add(["lighthouse.audit.target-size", "lighthouse.audit.heading-order"],
  ["La navigation dans le contenu est à vérifier", "Une structure ou des cibles inadaptées peuvent compliquer la navigation."],
  ["Review content navigation", "Unsuitable structure or targets can make navigation harder."]);
add(["html.scripts.count", "html.size.bytes", "html.analysis.duration_ms"],
  ["Le volume du document est à examiner", "Un document volumineux peut augmenter le transfert et le traitement."],
  ["Review document size", "A large document may increase transfer and processing work."]);
add(["ssl.certificate.valid", "ssl.certificate.expiry_days"],
  ["Le certificat de connexion est à vérifier", "Un certificat invalide ou expiré peut empêcher une connexion de confiance."],
  ["Review the connection certificate", "Invalid or expired certificates may prevent trusted connections."]);
add(["ssl.protocols.tls13", "ssl.protocols.tls12", "ssl.protocols.legacy_disabled"],
  ["Les protocoles de connexion sont à vérifier", "Des protocoles inadaptés peuvent affecter compatibilité et protection des échanges."],
  ["Review connection protocols", "Unsuitable protocols may affect compatibility and transport protection."]);
for (const [key, fr, en] of [
  ["lighthouse.score.performance", "Performance", "Performance"],
  ["lighthouse.score.accessibility", "Accessibilité", "Accessibility"],
  ["lighthouse.score.best-practices", "Bonnes pratiques", "Best practices"],
  ["lighthouse.score.seo", "Référencement", "SEO"],
  ["ssl.grade", "SSL Labs", "SSL Labs"], ["observatory.score", "Observatory", "Observatory"],
]) add([key],
  [`Score ${key.startsWith("lighthouse") ? "Lighthouse — " : ""}${fr} à examiner`, "Une note agrégée résume plusieurs contrôles ; elle ne désigne pas une cause unique."],
  [`Review ${key.startsWith("lighthouse") ? "Lighthouse — " : ""}${en} score`, "An aggregate score summarises several checks; it does not identify a single cause."]);

// Shared guidance does not imply a shared cause: each check keeps a specific title.
const titles: Record<string, [string, string]> = {
  "http.status_code": ["La réponse de la page est à vérifier", "Review the page response"],
  "http.errors": ["Des erreurs HTTP sont à examiner", "Review HTTP errors"],
  "http.response_time_ms": ["Le délai de réponse du serveur est à examiner", "Review server response time"],
  "http.redirect.count": ["La chaîne de redirections est à examiner", "Review the redirect chain"],
  "http.protocol.version": ["Le protocole HTTP utilisé est à examiner", "Review the HTTP protocol in use"],
  "http.protocol.http2": ["La disponibilité de HTTP/2 est à vérifier", "Review HTTP/2 availability"],
  "http.headers.compression": ["La compression des réponses est à vérifier", "Review response compression"],
  "http.headers.caching": ["La mise en cache des réponses est à vérifier", "Review response caching"],
  "http.headers.server": ["Les informations du serveur sont à examiner", "Review server information"],
  "http.headers.content_type": ["Le type MIME de la réponse est à vérifier", "Review the response MIME type"],
  "html.title": ["Le titre de la page est à préciser", "Clarify the page title"],
  "html.meta.description.present": ["La description de la page est à vérifier", "Review the page description"],
  "html.h1.count": ["Le titre principal de la page est à vérifier", "Review the main page heading"],
  "html.social.meta": ["L’aperçu de partage est à préciser", "Clarify the sharing preview"],
  "html.link.canonical.present": ["L’adresse canonique est à vérifier", "Review the canonical address"],
  "html.meta.robots.present": ["Les directives d’indexation sont à vérifier", "Review indexing directives"],
  "http.seo.robots_txt": ["Le fichier robots.txt est à vérifier", "Review the robots.txt file"],
  "http.seo.sitemap": ["Le plan de site est à vérifier", "Review the sitemap"],
  "html.meta.viewport.present": ["L’affichage sur mobile est à vérifier", "Review mobile display settings"],
  "html.doctype.html5": ["La déclaration du document est à vérifier", "Review the document declaration"],
  "html.meta.charset.present": ["L’encodage du document est à vérifier", "Review document encoding"],
  "html.lang": ["La langue du document est à vérifier", "Review document language"],
  "html.scripts.count": ["Le nombre de scripts est à examiner", "Review the number of scripts"],
  "html.size.bytes": ["Le poids du document HTML est à examiner", "Review HTML document size"],
  "html.analysis.duration_ms": ["La durée de l’analyse HTML est à examiner", "Review HTML analysis duration"],
  "runtime.network.request_count": ["Le nombre de requêtes est à examiner", "Review the request count"],
  "runtime.network.bytes_estimated": ["Le transfert estimé est à examiner", "Review estimated transfer size"],
  "runtime.network.5xx": ["Des réponses serveur en erreur sont à examiner", "Review server error responses"],
  "runtime.network.failed_requests": ["Des requêtes en échec sont à examiner", "Review failed requests"],
  "runtime.network.third_party_errors": ["Des incidents réseau tiers sont à examiner", "Review third-party network incidents"],
  "runtime.analysis.duration_ms": ["La durée de l’observation navigateur est à examiner", "Review browser observation duration"],
  "ssl.certificate.expiry_days": ["Le renouvellement du certificat est à vérifier", "Review certificate renewal"],
  "ssl.protocols.tls13": ["La disponibilité de TLS 1.3 est à vérifier", "Review TLS 1.3 availability"],
  "ssl.protocols.tls12": ["La disponibilité de TLS 1.2 est à vérifier", "Review TLS 1.2 availability"],
  "ssl.protocols.legacy_disabled": ["Les anciens protocoles TLS sont à examiner", "Review legacy TLS protocols"],
  "lighthouse.audit.target-size": ["Les zones tactiles sont à examiner", "Review touch targets"],
  "lighthouse.audit.heading-order": ["La structure des titres est à clarifier", "Clarify heading structure"],
};
for (const [key, title] of Object.entries(titles)) {
  catalogue[key].fr[0] = title[0]; catalogue[key].en[0] = title[1];
}
// Keys emitted by current Lighthouse insight diagnostics; preserve historical IDs.
for (const [current, historical] of Object.entries({
  "lcp-discovery-insight": "largest-contentful-paint", "lcp-breakdown-insight": "largest-contentful-paint",
  "render-blocking-insight": "render-blocking-resources", "image-delivery-insight": "image-delivery",
  "cls-culprits-insight": "cumulative-layout-shift", "document-latency-insight": "first-contentful-paint",
})) add([`lighthouse.audit.${current}`], catalogue[`lighthouse.audit.${historical}`].fr, catalogue[`lighthouse.audit.${historical}`].en);
add(["html.title"],
  [titles["html.title"][0], "Un titre peu descriptif peut rendre la page difficile à reconnaître dans les onglets et les résultats."],
  [titles["html.title"][1], "An unclear title can make the page hard to recognise in tabs and results."]);
add(["html.meta.description.present"],
  [titles["html.meta.description.present"][0], "Sans résumé spécifique, l’aperçu proposé aux moteurs peut manquer de contexte."],
  [titles["html.meta.description.present"][1], "Without a specific summary, search previews may lack context."]);
add(["html.h1.count"],
  [titles["html.h1.count"][0], "Un titre principal absent ou ambigu peut gêner la compréhension de la structure."],
  [titles["html.h1.count"][1], "A missing or ambiguous main heading can hinder understanding of the structure."]);
add(["html.social.meta"],
  [titles["html.social.meta"][0], "Un partage peut afficher un titre, une description ou une image peu représentatifs."],
  [titles["html.social.meta"][1], "A shared page may show an unrepresentative title, description or image."]);
add(["runtime.network.third_party_errors"],
  [titles["runtime.network.third_party_errors"][0], "Une intégration externe indisponible peut gêner une fonction ; son effet réel reste à reproduire."],
  [titles["runtime.network.third_party_errors"][1], "An unavailable external integration may affect a feature; its actual effect needs reproduction."]);
add(["lighthouse.audit.no-vulnerable-libraries"],
  ["Des dépendances signalées sont à vérifier", "Une dépendance signalée peut exposer une fonction si la version et les conditions d’exploitation sont confirmées."],
  ["Review flagged dependencies", "A flagged dependency may expose a feature if its version and exploit conditions are confirmed."]);
add(["runtime.network.failed_requests"],
  [titles["runtime.network.failed_requests"][0], "Une requête interrompue peut priver le parcours d’une ressource ; un blocage par le navigateur reste à distinguer d’une panne."],
  [titles["runtime.network.failed_requests"][1], "An interrupted request may deprive the journey of a resource; browser blocking needs to be distinguished from an outage."]);
add(["runtime.network.5xx"],
  [titles["runtime.network.5xx"][0], "Une réponse serveur en erreur peut empêcher une fonction de terminer."],
  [titles["runtime.network.5xx"][1], "A server error response may prevent a feature from completing."]);
add(["lighthouse.audit.unused-javascript"],
  ["Du JavaScript peu utilisé est à examiner", "Du code téléchargé sans usage au chargement peut alourdir le transfert."],
  ["Review underused JavaScript", "Code downloaded without use during loading may increase transfer size."]);
add(["lighthouse.audit.unused-css"],
  ["Des styles peu utilisés sont à examiner", "Des styles inutilisés sur cette page peuvent augmenter le téléchargement."],
  ["Review underused styles", "Styles unused on this page may increase downloads."]);
add(["lighthouse.audit.render-blocking-resources", "lighthouse.audit.render-blocking-insight"],
  ["Des ressources bloquent le premier affichage", "Le navigateur peut attendre certaines ressources avant d’afficher le contenu."],
  ["Resources block initial rendering", "The browser may wait for some resources before showing content."]);
// Verified against the pinned Lighthouse 13.5.0 default configuration.
for (const [id, source] of Object.entries({
  "unused-css-rules": "lighthouse.audit.unused-css", "errors-in-console": "runtime.console.errors",
  "is-on-https": "http.final_url.https", "redirects-http": "http.redirect.to_https",
  "http-status-code": "http.status_code", "doctype": "html.doctype.html5", "charset": "html.meta.charset.present",
  "meta-viewport": "html.meta.viewport.present", "input-image-alt": "lighthouse.audit.image-alt",
  "svg-img-alt": "lighthouse.audit.image-alt", "image-size-responsive": "lighthouse.audit.uses-responsive-images",
})) add([`lighthouse.audit.${id}`], catalogue[source].fr, catalogue[source].en);
add(["lighthouse.audit.document-title"],
  ["Le titre du document rendu est à vérifier", "Un titre absent ou peu explicite peut gêner la reconnaissance de la page par les technologies d’assistance."],
  ["Review the rendered document title", "A missing or unclear title can hinder recognition of the page by assistive technology."]);
add(["lighthouse.audit.meta-description"],
  ["La description du document rendu est à vérifier", "Une description absente ou vide peut laisser l’aperçu de la page sans résumé spécifique."],
  ["Review the rendered document description", "A missing or empty description may leave the preview without a page-specific summary."]);
add(["lighthouse.audit.interaction-to-next-paint", "lighthouse.audit.inp-breakdown-insight"],
  ["La réponse aux interactions est à examiner", "Une réponse visuelle tardive peut donner l’impression que le contrôle ne répond pas."],
  ["Review interaction responsiveness", "A delayed visual response can make a control appear unresponsive."]);
add(["lighthouse.audit.is-crawlable"],
  ["L’intention d’indexation de la page est à vérifier", "Une directive noindex peut écarter la page des résultats ; elle peut être intentionnelle."],
  ["Review whether page indexing is intended", "A noindex directive can exclude the page from search results; it may be intentional."]);
add(["tech.security.version_disclosure"],
  ["Des versions logicielles sont exposées", "Des bannières peuvent faciliter l’identification des logiciels ; elles ne prouvent pas une vulnérabilité."],
  ["Software versions are exposed", "Banners may help identify software; they do not prove a vulnerability."]);
add(["lighthouse.audit.lcp-discovery-insight"],
  ["La découverte de la ressource LCP est à examiner", "Une ressource découverte tardivement peut retarder l’affichage du contenu principal."],
  ["Review LCP resource discovery", "A late-discovered resource may delay the main content appearing."]);
add(["lighthouse.audit.lcp-breakdown-insight"],
  ["Les phases d’affichage du contenu principal sont à examiner", "La décomposition du LCP aide à chercher quelle phase retarde l’affichage."],
  ["Review the phases leading to main content display", "The LCP breakdown helps investigate which phase delays display."]);
add(["lighthouse.audit.image-delivery-insight"],
  ["Le poids des images téléchargées est à examiner", "Des images plus lourdes que nécessaire peuvent prolonger le téléchargement, notamment sur une connexion limitée."],
  ["Review downloaded image size", "Images larger than necessary can prolong downloads, especially on a limited connection."]);
add(["lighthouse.audit.cache-insight"],
  ["La réutilisation des ressources en cache est à vérifier", "Télécharger à nouveau des fichiers inchangés peut augmenter le transfert lors des visites suivantes."],
  ["Review cached resource reuse", "Downloading unchanged files again can increase transfer on subsequent visits."]);
for (const entry of detailedRuleGuidance) {
  if (entry.fr.title && entry.fr.impact && entry.en.title && entry.en.impact)
    add(entry.keys, [entry.fr.title, entry.fr.impact], [entry.en.title, entry.en.impact]);
}
export const supportedFindingKeys = Object.keys(catalogue);
export function findingEditorial(key: string | null | undefined, lang: Lang) {
  const copy = key ? catalogue[key]?.[lang] : undefined;
  const fallback: Copy = lang === "fr"
    ? ["Contrôle technique à examiner", "L’effet sur les utilisateurs n’est pas documenté pour ce contrôle ; le vérifier sur le parcours concerné."]
    : ["Technical check to review", "The effect on users is not documented for this check; verify it in the affected journey."];
  const resolved = copy ?? fallback;
  const playbook = findingPlaybook(key, lang);
  return { title: resolved[0], impact: resolved[1], recommendation: playbook.summary ?? playbook.steps.join(" "), verification: playbook.expected };
}
export function findingContent(issue: Issue, lang: Lang): FindingContent {
  const copy = findingEditorial(issue.id, lang);
  const explanation = findingExplanation(issue, lang);
  const uncertain = issue.confidence !== "HIGH" && issue.confidence !== "MEDIUM";
  const confirm = lang === "fr" ? "Confirmer le signal et son périmètre avant toute correction. " : "Confirm the signal and its scope before making changes. ";
  const recommendation = explanation.summary ?? explanation.steps.join(" ");
  const title = explanation.title ?? (issue.id && catalogue[issue.id] ? copy.title : cleanEvidence(issue.title) || copy.title);
  return {
    title,
    observation: explanation.observation ?? describeObservation(issue, title, lang),
    impact: explanation.impact ?? copy.impact,
    recommendation: recommendation ? (uncertain ? confirm : "") + recommendation : confirm.trim(),
    verification: explanation.expected,
    qualification: findingQualification(issue, lang), missingInformation: explanation.missingInformation ?? missingLocation(issue, lang),
  };
}

/** Localized rule label for navigation; source text remains in the diagnosis. */
export function findingTitle(key: string, lang: Lang): string {
  return catalogue[key]?.[lang][0] ?? (lang === "fr" ? "Contrôle technique à examiner" : "Technical check to review");
}
