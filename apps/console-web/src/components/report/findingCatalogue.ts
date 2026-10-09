import type { Issue } from "./types";
import type { Lang } from "@/lib/i18n/routes";

export const CATALOGUE_VERSION = "report-content-v1";
export type FindingContent = { title: string; observation: string; impact: string; recommendation: string; verification: string };
type Copy = [title: string, impact: string, recommendation: string, verification: string];
const catalogue: Record<string, Record<Lang, Copy>> = {};
function add(keys: string[], fr: Copy, en: Copy) { for (const key of keys) catalogue[key] = { fr, en }; }

add(["lighthouse.audit.largest-contentful-paint"],
  ["L’affichage du contenu principal est à examiner", "Une attente prolongée peut retarder la lecture de la page.", "Identifier l’élément principal et les ressources qui retardent son affichage.", "Comparer le LCP avant et après avec le même profil de mesure."],
  ["Review when the main content appears", "A long wait can delay reading the page.", "Identify the main element and resources delaying its display.", "Compare LCP before and after using the same measurement profile."]);
add(["lighthouse.audit.total-blocking-time", "lighthouse.audit.interactive"],
  ["Le travail du navigateur au chargement est à examiner", "Les tâches longues peuvent retarder les premières interactions.", "Examiner les tâches longues et différer le code non essentiel.", "Comparer les tâches longues et tester les premières interactions."],
  ["Review browser work during loading", "Long tasks may delay early interactions.", "Inspect long tasks and defer non-essential code.", "Compare long tasks and test early interactions."]);
add(["lighthouse.audit.first-contentful-paint", "lighthouse.audit.speed-index"],
  ["L’apparition des premiers contenus est à examiner", "Le visiteur peut attendre avant de percevoir une page utile.", "Examiner les ressources qui bloquent le premier affichage.", "Comparer le film du chargement dans les mêmes conditions."],
  ["Review when initial content appears", "Visitors may wait before seeing a useful page.", "Inspect resources blocking initial rendering.", "Compare loading filmstrips under the same conditions."]);
add(["lighthouse.audit.cumulative-layout-shift"],
  ["La stabilité visuelle est à examiner", "Les déplacements du contenu peuvent gêner la lecture et les clics.", "Identifier les éléments qui changent de position et réserver leur espace.", "Observer la stabilité au chargement et pendant les interactions."],
  ["Review visual stability", "Moving content can disrupt reading and clicking.", "Identify shifting elements and reserve their space.", "Check stability during loading and interactions."]);
add(["lighthouse.audit.unused-javascript", "lighthouse.audit.unused-css", "lighthouse.audit.render-blocking-resources"],
  ["Des ressources chargées méritent une revue", "Du code non essentiel peut augmenter le transfert et le travail du navigateur.", "Vérifier les usages avant de supprimer ou différer les ressources candidates.", "Comparer les transferts et vérifier l’absence de régression des parcours."],
  ["Review loaded resources", "Non-essential code can increase transfer size and browser work.", "Check usage before removing or deferring candidate resources.", "Compare transfers and check user journeys for regressions."]);
add(["lighthouse.audit.image-delivery", "lighthouse.audit.modern-image-formats", "lighthouse.audit.uses-optimized-images", "lighthouse.audit.uses-responsive-images", "lighthouse.audit.unsized-images"],
  ["Le chargement des images est à examiner", "Des ressources inadaptées peuvent ralentir l’affichage ou déplacer le contenu.", "Comparer les dimensions affichées, les dimensions téléchargées et le format.", "Vérifier le poids, la qualité et la stabilité des images sur mobile."],
  ["Review image loading", "Unsuitable resources can delay rendering or shift content.", "Compare displayed dimensions, downloaded dimensions and format.", "Check image size, quality and stability on mobile."]);
add(["http.security.hsts", "ssl.hsts"],
  ["La politique HTTPS du navigateur est à vérifier", "Une politique absente ou inadaptée peut laisser des navigations en HTTP.", "Valider la compatibilité HTTPS du périmètre avant de configurer HSTS.", "Inspecter Strict-Transport-Security sur les réponses et redirections concernées."],
  ["Review the browser HTTPS policy", "A missing or unsuitable policy may allow HTTP navigation.", "Validate HTTPS compatibility across the scope before configuring HSTS.", "Inspect Strict-Transport-Security on relevant responses and redirects."]);
add(["http.security.csp"],
  ["La politique de chargement des contenus est à vérifier", "Une politique explicite peut limiter les ressources exécutées dans le navigateur.", "Inventorier les sources nécessaires puis tester une politique CSP adaptée.", "Inspecter Content-Security-Policy et tester les intégrations légitimes."],
  ["Review the content loading policy", "An explicit policy can restrict resources executed in the browser.", "Inventory required sources, then test a suitable CSP policy.", "Inspect Content-Security-Policy and test legitimate integrations."]);
add(["http.security.x_frame_options"],
  ["L’intégration de la page dans un cadre est à vérifier", "Une intégration non maîtrisée peut exposer les interactions à un détournement.", "Définir les origines autorisées à intégrer la page.", "Vérifier frame-ancestors ou X-Frame-Options et les intégrations attendues."],
  ["Review page framing permissions", "Uncontrolled embedding may expose interactions to misuse.", "Define which origins may embed the page.", "Check frame-ancestors or X-Frame-Options and intended embeds."]);
add(["http.security.x_content_type_options", "http.headers.content_type"],
  ["Le type des ressources est à vérifier", "Un type incorrect peut perturber l’interprétation des ressources.", "Vérifier les types MIME et la politique nosniff selon les ressources.", "Inspecter Content-Type et X-Content-Type-Options sur les réponses concernées."],
  ["Review resource content types", "Incorrect types may disrupt resource interpretation.", "Check MIME types and the nosniff policy for each resource.", "Inspect Content-Type and X-Content-Type-Options on relevant responses."]);
add(["http.security.referrer_policy"],
  ["La transmission du référent est à vérifier", "La navigation peut transmettre des informations sur la page d’origine.", "Choisir une politique de référent adaptée aux intégrations.", "Inspecter Referrer-Policy et tester les navigations externes."],
  ["Review referrer information sharing", "Navigation may disclose information about the originating page.", "Choose a referrer policy suitable for integrations.", "Inspect Referrer-Policy and test external navigation."]);
add(["http.security.permissions_policy"],
  ["Les permissions du navigateur sont à préciser", "Des fonctionnalités sensibles peuvent être accessibles aux contenus intégrés.", "Limiter les permissions aux fonctionnalités et origines nécessaires.", "Inspecter Permissions-Policy et tester les fonctionnalités autorisées."],
  ["Review browser permissions", "Embedded content may access sensitive capabilities.", "Restrict permissions to required features and origins.", "Inspect Permissions-Policy and test allowed features."]);
add(["http.security.cookie_flags"],
  ["Les protections des cookies sont à vérifier", "Des attributs inadaptés peuvent exposer les cookies à des usages indésirables.", "Examiner chaque cookie et adapter Secure, HttpOnly et SameSite à son usage.", "Inspecter chaque Set-Cookie et tester connexion et intégrations."],
  ["Review cookie protections", "Unsuitable attributes may expose cookies to unintended use.", "Review each cookie and adapt Secure, HttpOnly and SameSite to its purpose.", "Inspect each Set-Cookie and test sign-in and integrations."]);
add(["http.final_url.https", "http.redirect.to_https"],
  ["Le parcours vers HTTPS est à vérifier", "Une connexion HTTP peut exposer les données en transit.", "Vérifier le certificat et les redirections vers HTTPS.", "Tester l’URL initiale et la destination finale en HTTP et HTTPS."],
  ["Review the HTTPS navigation path", "HTTP connections can expose data in transit.", "Check the certificate and redirects to HTTPS.", "Test initial and final URLs over HTTP and HTTPS."]);
add(["http.status_code", "http.errors", "runtime.network.5xx", "runtime.network.failed_requests", "runtime.network.third_party_errors"],
  ["Des réponses réseau sont à examiner", "Des ressources indisponibles peuvent interrompre le parcours observé.", "Reproduire les requêtes en erreur et examiner les journaux de leur fournisseur.", "Rejouer le parcours et vérifier les réponses des ressources concernées."],
  ["Review network responses", "Unavailable resources may interrupt the observed journey.", "Reproduce failing requests and inspect their provider’s logs.", "Replay the journey and check the affected resource responses."]);
add(["runtime.console.errors", "runtime.js.errors"],
  ["Des erreurs de scripts sont à examiner", "Une erreur peut empêcher certaines fonctions de la page.", "Reproduire l’erreur et identifier le script et le parcours concernés.", "Tester le parcours corrigé et vérifier la console du navigateur."],
  ["Review script errors", "An error may prevent some page functions from working.", "Reproduce the error and identify the affected script and journey.", "Test the corrected journey and inspect the browser console."]);
add(["http.response_time_ms", "http.redirect.count", "http.protocol.version", "http.protocol.http2", "http.headers.compression", "http.headers.caching", "http.headers.server", "runtime.network.request_count", "runtime.network.bytes_estimated", "runtime.analysis.duration_ms"],
  ["Le coût du chargement est à examiner", "Le transfert et les échanges réseau peuvent allonger l’attente selon la connexion.", "Examiner la cascade réseau et confirmer les ressources ou échanges coûteux.", "Comparer les échanges et le transfert dans des conditions comparables."],
  ["Review loading overhead", "Transfers and network exchanges may increase waiting time depending on the connection.", "Inspect the network waterfall and confirm costly resources or exchanges.", "Compare network exchanges and transfers under comparable conditions."]);
add(["http.antibot.challenge"],
  ["Une protection limite l’observation", "Le contenu mesuré peut être une page de vérification plutôt que le site attendu.", "Confirmer le périmètre réellement observé avant de décider d’une correction.", "Vérifier la page reçue et relancer une mesure autorisée du contenu attendu."],
  ["A protection limits observation", "Measured content may be a challenge page rather than the intended site.", "Confirm the actual observed scope before deciding on a correction.", "Check the received page and repeat an authorised measurement of intended content."]);
add(["html.title", "html.meta.description.present", "html.h1.count", "html.social.meta"],
  ["La présentation du contenu est à préciser", "Des métadonnées incomplètes peuvent rendre le contenu moins compréhensible dans les aperçus.", "Rédiger des titres et descriptions fidèles et spécifiques à la page.", "Inspecter le HTML et les aperçus, sans déduire un classement dans les moteurs."],
  ["Clarify how content is presented", "Incomplete metadata may make content harder to understand in previews.", "Write accurate titles and descriptions specific to the page.", "Inspect HTML and previews without inferring search rankings."]);
add(["html.link.canonical.present", "html.meta.robots.present", "http.seo.robots_txt", "http.seo.sitemap"],
  ["Les indications aux moteurs sont à vérifier", "Des indications incohérentes peuvent gêner la découverte des pages attendues.", "Vérifier les règles d’indexation et les URLs canoniques selon le périmètre souhaité.", "Inspecter robots, sitemap et canonical des pages concernées."],
  ["Review search engine directives", "Inconsistent directives can hinder discovery of intended pages.", "Check indexing rules and canonical URLs against the intended scope.", "Inspect robots, sitemap and canonical for affected pages."]);
add(["html.meta.viewport.present", "html.doctype.html5", "html.meta.charset.present", "html.lang", "lighthouse.audit.html-has-lang", "lighthouse.audit.html-lang-valid"],
  ["Le contexte du document est à vérifier", "Une déclaration inadaptée peut gêner l’affichage ou les technologies d’assistance.", "Vérifier la langue, l’encodage et les déclarations du document.", "Inspecter le DOM rendu et tester l’affichage et la lecture assistée."],
  ["Review document context", "Unsuitable declarations can hinder rendering or assistive technology.", "Check language, encoding and document declarations.", "Inspect the rendered DOM and test display and assisted reading."]);
add(["html.images.alt_coverage", "lighthouse.audit.image-alt"],
  ["Les alternatives des images sont à vérifier", "Une image informative sans alternative peut perdre son sens en lecture assistée.", "Distinguer images informatives et décoratives, puis adapter les alternatives.", "Vérifier le nom accessible et tester le contenu sans affichage des images."],
  ["Review image alternatives", "Informative images without alternatives may lose their meaning in assisted reading.", "Distinguish informative and decorative images, then adapt alternatives.", "Check accessible names and test content without visible images."]);
add(["html.anchors.href_coverage", "lighthouse.audit.button-name", "lighthouse.audit.link-name", "lighthouse.audit.label", "lighthouse.audit.input-button-name", "lighthouse.audit.select-name"],
  ["La fonction des contrôles est à clarifier", "Un contrôle sans nom ou destination peut être difficile à comprendre ou à utiliser.", "Associer un nom accessible et une destination ou action explicite aux contrôles.", "Inspecter l’arbre d’accessibilité et tester le parcours au clavier."],
  ["Clarify control functions", "Controls without a name or destination can be difficult to understand or use.", "Give controls an accessible name and explicit destination or action.", "Inspect the accessibility tree and test the keyboard journey."]);
add(["lighthouse.audit.color-contrast"],
  ["La lisibilité des couleurs est à vérifier", "Un contraste insuffisant peut rendre le texte difficile à lire.", "Examiner les couleurs réelles du texte et du fond dans les états concernés.", "Re-mesurer le contraste et vérifier les variantes de thème et d’interaction."],
  ["Review colour readability", "Insufficient contrast may make text hard to read.", "Inspect actual text and background colours in affected states.", "Re-measure contrast and check theme and interaction variants."]);
add(["lighthouse.audit.target-size", "lighthouse.audit.heading-order"],
  ["La navigation dans le contenu est à vérifier", "Une structure ou des cibles inadaptées peuvent compliquer la navigation.", "Examiner les éléments signalés et adapter la structure ou les zones d’action.", "Tester les parcours tactile, clavier et lecteur d’écran concernés."],
  ["Review content navigation", "Unsuitable structure or targets can make navigation harder.", "Inspect reported elements and adapt structure or action areas.", "Test affected touch, keyboard and screen reader journeys."]);
add(["html.scripts.count", "html.size.bytes", "html.analysis.duration_ms"],
  ["Le volume du document est à examiner", "Un document volumineux peut augmenter le transfert et le traitement.", "Identifier le contenu et les scripts nécessaires au parcours observé.", "Comparer le volume et vérifier que les parcours restent fonctionnels."],
  ["Review document size", "A large document may increase transfer and processing work.", "Identify content and scripts needed for the observed journey.", "Compare size and check that journeys still work."]);
add(["ssl.certificate.valid", "ssl.certificate.expiry_days"],
  ["Le certificat de connexion est à vérifier", "Un certificat invalide ou expiré peut empêcher une connexion de confiance.", "Confirmer les hôtes concernés puis vérifier la chaîne et le renouvellement.", "Tester le certificat présenté par chaque point de terminaison concerné."],
  ["Review the connection certificate", "Invalid or expired certificates may prevent trusted connections.", "Confirm affected hosts, then check the chain and renewal.", "Test the certificate presented by each affected endpoint."]);
add(["ssl.protocols.tls13", "ssl.protocols.tls12", "ssl.protocols.legacy_disabled"],
  ["Les protocoles de connexion sont à vérifier", "Des protocoles inadaptés peuvent affecter compatibilité et protection des échanges.", "Confirmer les résultats par point de terminaison avant de modifier les protocoles.", "Re-tester les versions TLS acceptées et la compatibilité des clients attendus."],
  ["Review connection protocols", "Unsuitable protocols may affect compatibility and transport protection.", "Confirm results for each endpoint before changing protocols.", "Re-test accepted TLS versions and intended client compatibility."]);
for (const [key, fr, en] of [
  ["lighthouse.score.performance", "Performance", "Performance"],
  ["lighthouse.score.accessibility", "Accessibilité", "Accessibility"],
  ["lighthouse.score.best-practices", "Bonnes pratiques", "Best practices"],
  ["lighthouse.score.seo", "Référencement", "SEO"],
  ["ssl.grade", "SSL Labs", "SSL Labs"], ["observatory.score", "Observatory", "Observatory"],
]) add([key],
  [`Score ${key.startsWith("lighthouse") ? "Lighthouse — " : ""}${fr} à examiner`, "Une note agrégée résume plusieurs contrôles ; elle ne désigne pas une cause unique.", "Examiner les contrôles détaillés de cet outil avant de choisir les corrections.", "Re-mesurer la note de l’outil et les contrôles concernés avec le même périmètre."],
  [`Review ${key.startsWith("lighthouse") ? "Lighthouse — " : ""}${en} score`, "An aggregate score summarises several checks; it does not identify a single cause.", "Inspect the tool’s detailed checks before choosing corrections.", "Re-measure the tool score and affected checks over the same scope."]);

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
export const supportedFindingKeys = Object.keys(catalogue);
export function cleanEvidence(text?: string | null): string {
  return (text ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/https?:\/\/[^\s<>"}\]]+/g, value => {
      try { const url = new URL(value); url.username = ""; url.password = ""; url.search = ""; url.hash = ""; return url.toString(); }
      catch { return "[URL]"; }
    }).slice(0, 4000);
}
export function findingContent(issue: Issue, lang: Lang): FindingContent {
  const copy = issue.id ? catalogue[issue.id]?.[lang] : undefined;
  const uncertain = issue.confidence !== "HIGH" && issue.confidence !== "MEDIUM";
  const confirm = lang === "fr" ? "Confirmer le signal et son périmètre avant toute correction. " : "Confirm the signal and its scope before making changes. ";
  return {
    title: copy?.[0] ?? (cleanEvidence(issue.title) || (lang === "fr" ? "Constat à examiner" : "Finding to review")),
    observation: lang === "fr" ? "Le contrôle a signalé un point à examiner dans le périmètre mesuré." : "The check flagged a point to review within the measured scope.",
    impact: copy?.[1] ?? (cleanEvidence(issue.impact) || (lang === "fr" ? "Impact non renseigné." : "Impact not provided.")),
    recommendation: (uncertain ? confirm : "") + (copy?.[2] ?? (cleanEvidence(issue.recommendation) || confirm)),
    verification: copy?.[3] ?? (lang === "fr" ? "Reproduire l’observation puis relancer le contrôle dans les mêmes conditions." : "Reproduce the observation, then repeat the check under the same conditions."),
  };
}
