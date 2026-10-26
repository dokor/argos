import type { Lang } from '@/lib/i18n/routes';
import { detailedRuleGuidance } from './findingRuleGuidance';
export type PlaybookCopy = { title?: string; impact?: string; detection: string; summary?: string; steps: string[]; expected: string; example: string; limits: string };
export type Playbook = { reference?: string; verifiedAt?: string; specific: boolean } & PlaybookCopy;
export const playbookGroups: Array<{keys: string[]; reference: string; verifiedAt: string; fr: PlaybookCopy; en: PlaybookCopy}> = [
  {
    "keys": [
      "html.title"
    ],
    "reference": "https://developers.google.com/search/docs/appearance/title-link",
    "verifiedAt": "2026-10-17",
    "fr": {
      "detection": "Le module HTML examine le titre du document reçu, sans exécuter JavaScript. Les bornes de longueur sont des heuristiques Argos ; la méthode enregistrée avec le constat précise celles réellement appliquées.",
      "steps": [
        "Dans les outils du navigateur, ouvrir Réseau, sélectionner le document principal puis Réponse et rechercher <title>. Comparer avec le titre de l’onglet si JavaScript le modifie.",
        "Repérer le champ éditorial ou le gabarit qui produit ce titre pour cette URL. S’il est absent ou vide, le renseigner ; s’il est court ou long, vérifier d’abord si son contenu décrit bien la page.",
        "Écrire un titre concis qui nomme le sujet propre à la page. Éviter de remplacer tous les titres par le seul nom du site ou de viser une longueur sans améliorer le sens.",
        "Recharger la même URL sans cache et contrôler à nouveau le HTML reçu puis l’onglet. Vérifier aussi une autre page utilisant le même gabarit."
      ],
      "expected": "Le document reçu contient un titre non vide et propre à la page. Vérifier son sens à la lecture, puis relancer Argos : une longueur dans les bornes supprime ce signal de longueur, mais ne prouve ni qualité éditoriale ni classement dans un moteur.",
      "example": "<title>Sac en coton bleu — Atelier exemple</title>",
      "limits": "Un titre absent et un titre vide produisent tous deux une longueur nulle. La longueur est calculée sur le texte extrait par le parseur Java, pas sur sa largeur visuelle. Google peut afficher un autre titre ; ses recommandations ne fixent pas ces bornes Argos.",
      "summary": "Renseigner ou réviser le titre dans le champ ou le gabarit de cette page, puis vérifier son sens, le HTML reçu et le titre de l’onglet."
    },
    "en": {
      "detection": "The HTML module examines the received document title without executing JavaScript. Length bounds are Argos heuristics; the method stored with the finding identifies those actually applied.",
      "steps": [
        "In browser tools, open Network, select the main document, then Response and search for <title>. Compare it with the tab title if JavaScript changes it.",
        "Locate the editorial field or template producing this URL’s title. Fill it in if absent or empty; if short or long, first check whether it accurately describes the page.",
        "Write a concise title naming this page’s specific subject. Avoid using only the site name for every page or targeting a length without improving meaning.",
        "Reload the same URL without cache and check the received HTML and tab again. Also check another page using the same template."
      ],
      "expected": "The received document contains a non-empty, page-specific title. Review its meaning, then rerun Argos: a length within the bounds clears this length signal but proves neither editorial quality nor search ranking.",
      "example": "<title>Blue cotton bag — Example studio</title>",
      "limits": "An absent title and an empty title both produce a zero length. Length uses text extracted by the Java parser, rather than visual width. Google may display another title; its guidance does not prescribe these Argos bounds.",
      "summary": "Fill in or revise the title in this page’s field or template, then check its meaning, received HTML and browser tab title."
    }
  },
  {
    "keys": [
      "html.images.alt_coverage"
    ],
    "reference": "https://www.w3.org/WAI/tutorials/images/decision-tree/",
    "verifiedAt": "2026-10-17",
    "fr": {
      "detection": "Le module HTML compte les éléments img sans attribut alt dans le document reçu, sans exécuter JavaScript. Un attribut alt vide est présent et ne déclenche pas ce contrôle.",
      "steps": [
        "Dans Réseau → document principal → Réponse, retrouver les img sans attribut alt. Si Argos ne conserve pas leur emplacement, ce repérage est nécessaire ; le sélecteur img:not([alt]) aide à examiner le DOM rendu, qui peut différer du HTML reçu.",
        "Décider de la fonction de chaque image : transmettre une information, décorer ou servir de lien/bouton. Lire le texte voisin avant de rédiger une alternative.",
        "Dans le contenu ou le gabarit qui produit l’image, décrire l’information utile dans alt ; utiliser alt=\"\" pour une décoration. Pour une image lien ou bouton, exprimer sa destination ou son action.",
        "Recharger sans cache. Vérifier le HTML reçu, puis le DOM rendu et le nom accessible ; relire le parcours avec un lecteur d’écran lorsque possible."
      ],
      "expected": "Dans le même HTML reçu, aucune image ne manque d’attribut alt ; relancer Argos pour vérifier ce compteur. Une personne doit encore confirmer que les alternatives restituent l’information ou l’action et que les images décoratives restent silencieuses.",
      "example": "<!-- Image informative : décrire l’information utile -->\n<img src=\"/sac-exemple.jpg\" alt=\"Sac bleu à anses courtes\">\n<!-- Décoration : alternative vide -->\n<img src=\"/decoration-exemple.svg\" alt=\"\">",
      "limits": "L’absence d’attribut est observable ; le caractère informatif et la pertinence de l’alternative demandent une revue humaine. Les images ajoutées par JavaScript, les images CSS et les autres pages ne sont pas couvertes par ce compteur HTML. Aucun élément n’est reconstitué depuis un nombre.",
      "summary": "Retrouver les images sans alt et choisir une alternative selon leur fonction : information, décoration ou action. Vérifier ensuite le HTML et le nom accessible."
    },
    "en": {
      "detection": "The HTML module counts img elements without an alt attribute in the received document, without executing JavaScript. An empty alt attribute is present and does not trigger this check.",
      "steps": [
        "In Network → main document → Response, locate img elements without alt. If Argos retains no location, this investigation is necessary; img:not([alt]) helps inspect the rendered DOM, which may differ from received HTML.",
        "Determine each image’s function: conveying information, decorating, or acting as a link/button. Read surrounding text before writing an alternative.",
        "In the content or template producing the image, put the useful information in alt; use alt=\"\" for decoration. For a linked image or button, express the destination or action.",
        "Reload without cache. Check received HTML, then the rendered DOM and accessible name; read the journey with a screen reader when possible."
      ],
      "expected": "In the same received HTML, no image lacks an alt attribute; rerun Argos to verify this count. A person must still confirm that alternatives convey information or actions and that decorative images remain silent.",
      "example": "<!-- Informative image: convey the useful information -->\n<img src=\"/example-bag.jpg\" alt=\"Blue bag with short handles\">\n<!-- Decoration: empty alternative -->\n<img src=\"/example-decoration.svg\" alt=\"\">",
      "limits": "A missing attribute is observable; whether the image is informative and its alternative appropriate requires human review. Images added by JavaScript, CSS images and other pages are outside this HTML count. No element is reconstructed from a number.",
      "summary": "Locate images without alt and choose an alternative according to their function: information, decoration or action. Then check HTML and accessible names."
    }
  },
  {
    "keys": [
      "http.security.csp"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP",
    "verifiedAt": "2026-10-17",
    "fr": {
      "detection": "La méthode dépend de la source conservée : le collecteur HTTP examine l’en-tête Content-Security-Policy de la réponse finale ; une alerte ZAP suit sa propre règle. Le détail ci-dessous distingue une absence d’une politique non reconnue lorsque cette information a été enregistrée.",
      "steps": [
        "Ouvrir Réseau dans les outils du navigateur, recharger cette URL et sélectionner le document final après redirection. Dans En-têtes de réponse, lire Content-Security-Policy et distinguer Content-Security-Policy-Report-Only.",
        "Si une politique existe, examiner ses directives et la règle source avant de la remplacer : le validateur Argos ne reconnaît qu’un sous-ensemble des politiques possibles.",
        "Si une politique doit être ajoutée ou ajustée, inventorier scripts, styles, images, connexions et contenus intégrés nécessaires. La tester d’abord en Report-Only dans un environnement maîtrisé et examiner les violations dans la console.",
        "Adapter la politique au point qui produit la réponse (application, proxy ou CDN). Après validation, appliquer l’en-tête Content-Security-Policy et tester formulaires, connexion, paiement et intégrations réellement présents."
      ],
      "expected": "Vérifier l’en-tête reçu sur la même réponse finale et tester les fonctions légitimes avec la politique appliquée. Report-Only seul n’applique pas les restrictions. Relancer la même source d’audit ; une réussite de ce contrôle ne démontre pas l’absence de XSS.",
      "example": "Content-Security-Policy-Report-Only: default-src 'self'; object-src 'none'; base-uri 'self'",
      "limits": "Une politique non reconnue n’est pas forcément inefficace. Les politiques multiples ou complexes exigent une revue ; une CSP dans une balise meta n’est pas cette observation d’en-tête. L’exemple Report-Only sert à l’essai et doit être adapté avant toute application.",
      "summary": "Vérifier la politique reçue et la règle source. Si elle doit évoluer, inventorier les ressources, tester en Report-Only puis contrôler les parcours avant application."
    },
    "en": {
      "detection": "The method depends on the retained source: the HTTP collector examines the final response Content-Security-Policy header; a ZAP alert follows its own rule. The details distinguish absence from an unrecognised policy when that information was recorded.",
      "steps": [
        "Open Network in browser tools, reload this URL and select the final document after redirects. In Response Headers, read Content-Security-Policy and distinguish Content-Security-Policy-Report-Only.",
        "If a policy exists, inspect its directives and the source rule before replacing it: the Argos validator recognises only a subset of possible policies.",
        "If a policy needs adding or adjusting, inventory required scripts, styles, images, connections and embeds. Test it first in Report-Only in a controlled environment and inspect console violations.",
        "Adapt the policy where the response is produced (application, proxy or CDN). Once validated, apply the Content-Security-Policy header and test forms, sign-in, payments and integrations actually present."
      ],
      "expected": "Check the received header on the same final response and test legitimate functions with enforcement enabled. Report-Only alone does not enforce restrictions. Rerun the same audit source; passing this check does not demonstrate the absence of XSS.",
      "example": "Content-Security-Policy-Report-Only: default-src 'self'; object-src 'none'; base-uri 'self'",
      "limits": "An unrecognised policy is not necessarily ineffective. Multiple or complex policies need review; a CSP meta tag is outside this header observation. The Report-Only example is for testing and must be adapted before enforcement.",
      "summary": "Check the received policy and source rule. If it needs changing, inventory resources, test in Report-Only, then check journeys before enforcement."
    }
  },
  {
    "keys": [
      "lighthouse.audit.largest-contentful-paint"
    ],
    "reference": "https://web.dev/articles/optimize-lcp",
    "verifiedAt": "2026-10-17",
    "fr": {
      "detection": "Lighthouse mesure l’affichage du plus grand élément admissible dans la zone visible pendant un chargement de laboratoire. Argos sélectionne cet audit selon son score normalisé ; seule une valeur numericValue accompagnée de numericUnit fournit une durée.",
      "steps": [
        "Reproduire la même URL avec le même profil mobile/desktop et les mêmes conditions réseau. Dans une trace Performance, retrouver l’élément LCP ; son absence dans Argos ne permet pas de deviner une image ou un fichier.",
        "Examiner les phases : réponse du document, attente avant découverte de la ressource, transfert, puis attente avant affichage. Identifier celle qui occupe réellement le temps.",
        "Si l’élément est une image découverte tardivement, examiner sa présence dans le HTML initial et son chargement différé ; si le transfert est coûteux, examiner format et dimensions. Si c’est du texte ou si le rendu attend, examiner polices et tâches bloquantes selon la trace.",
        "Changer un facteur à la fois, vérifier l’affichage et les interactions, puis refaire plusieurs chargements comparables et relancer Argos."
      ],
      "expected": "La phase ciblée et la durée LCP diminuent sur plusieurs mesures au même profil sans casser le parcours. Conserver les conditions et les résultats avant/après ; un résultat isolé ou une hausse du score seul ne suffit pas.",
      "example": "",
      "limits": "Cette mesure de laboratoire ne représente pas toutes les visites. Le LCP peut être du texte, une image ou un autre élément admissible ; une durée élevée ne démontre pas une image trop lourde ni un serveur lent. Sans élément ou détail de phase conservé, consulter la trace source.",
      "summary": "Identifier l’élément LCP et la phase coûteuse dans une trace de cette URL. Intervenir sur la cause observée, puis répéter les mesures au même profil."
    },
    "en": {
      "detection": "Lighthouse measures when the largest eligible element in the viewport appears during a laboratory page load. Argos selects this audit by its normalised score; only numericValue with numericUnit supplies a duration.",
      "steps": [
        "Reproduce the same URL with the same mobile/desktop profile and network conditions. In a Performance trace, locate the LCP element; its absence from Argos cannot identify an image or file.",
        "Examine the phases: document response, delay before resource discovery, transfer, then delay before rendering. Identify which actually consumes the time.",
        "If the element is a late-discovered image, inspect its presence in initial HTML and lazy loading; if transfer is costly, inspect format and dimensions. For text or delayed rendering, investigate fonts and blocking tasks according to the trace.",
        "Change one factor at a time, check display and interactions, then repeat several comparable loads and rerun Argos."
      ],
      "expected": "The targeted phase and LCP duration decrease over several measurements with the same profile without breaking the journey. Keep before/after conditions and results; one isolated result or a higher score alone is insufficient.",
      "example": "",
      "limits": "This laboratory measurement does not represent all visits. LCP may be text, an image or another eligible element; a high duration does not demonstrate an oversized image or a slow server. Without a retained element or phase detail, consult the source trace.",
      "summary": "Identify the LCP element and costly phase in this URL’s trace. Address the observed cause, then repeat measurements with the same profile."
    }
  },
  {
    "keys": [
      "lighthouse.audit.lcp-discovery-insight"
    ],
    "reference": "https://web.dev/articles/optimize-lcp",
    "verifiedAt": "2026-10-17",
    "fr": {
      "detection": "Ce diagnostic Lighthouse concerne la découverte de la ressource LCP. Son score de sélection et un éventuel gain estimé ne sont pas la durée totale LCP.",
      "steps": [
        "Dans la trace Lighthouse de cette URL, retrouver la ressource LCP signalée. Si elle n’est pas conservée, ouvrir le diagnostic source avant de modifier une ressource.",
        "Examiner quand le navigateur peut découvrir cette ressource, sa présence dans le HTML initial et sa priorité. Adapter uniquement le mécanisme qui la retarde ; ne pas précharger toutes les images.",
        "Comparer le début de requête, le LCP et le parcours sur plusieurs chargements au même profil, puis relancer l’audit."
      ],
      "expected": "La ressource effectivement signalée est découverte plus tôt et le LCP est comparé dans les mêmes conditions ; vérifier que les autres ressources essentielles ne sont pas retardées.",
      "example": "",
      "limits": "Un gain estimé ne garantit pas une amélioration de même ampleur. Ce diagnostic ne prouve ni un transfert lourd ni la durée totale LCP.",
      "summary": "Retrouver la ressource LCP signalée et ce qui retarde sa découverte. Comparer ensuite le début de requête et le LCP au même profil."
    },
    "en": {
      "detection": "This Lighthouse diagnosis concerns LCP resource discovery. Its selection score and any estimated savings are not the total LCP duration.",
      "steps": [
        "In this URL’s Lighthouse trace, locate the reported LCP resource. If it was not retained, open the source diagnosis before changing a resource.",
        "Inspect when the browser can discover the resource, its presence in initial HTML and its priority. Adjust only the mechanism delaying it; do not preload every image.",
        "Compare request start, LCP and the journey over several loads with the same profile, then rerun the audit."
      ],
      "expected": "The actual reported resource is discovered earlier and LCP is compared under the same conditions; check that other essential resources are not delayed.",
      "example": "",
      "limits": "Estimated savings do not guarantee an improvement of the same size. This diagnosis proves neither a heavy transfer nor total LCP duration.",
      "summary": "Locate the reported LCP resource and what delays its discovery. Then compare request start and LCP with the same profile."
    }
  },
  {
    "keys": [
      "lighthouse.audit.lcp-breakdown-insight"
    ],
    "reference": "https://web.dev/articles/optimize-lcp",
    "verifiedAt": "2026-10-17",
    "fr": {
      "detection": "Ce diagnostic Lighthouse décompose les phases menant au LCP. Une valeur numérique éventuelle appartient au diagnostic et ne doit pas être présentée automatiquement comme la durée totale LCP.",
      "steps": [
        "Ouvrir la décomposition LCP de cette URL dans Lighthouse ou une trace Performance. Relever les phases et leur périmètre ; si elles ne sont pas conservées par Argos, les consulter dans la source.",
        "Identifier la phase la plus coûteuse avant d’agir : réponse du document, découverte, transfert ou rendu. Choisir une intervention correspondant à cette phase et à l’élément réellement observé.",
        "Comparer les mêmes phases et le LCP sur plusieurs chargements au même profil, puis tester le parcours et relancer l’audit."
      ],
      "expected": "La phase visée diminue dans des traces comparables ; confirmer séparément l’évolution de la durée totale LCP et le fonctionnement du parcours.",
      "example": "",
      "limits": "Le diagnostic peut manquer pour une mesure historique ou une autre version de Lighthouse. Son score seul ne fournit ni durée de phase ni cause démontrée.",
      "summary": "Comparer les phases de la trace LCP et cibler celle qui coûte réellement du temps. Vérifier séparément la phase corrigée et le LCP total."
    },
    "en": {
      "detection": "This Lighthouse diagnosis breaks down phases leading to LCP. Any numeric value belongs to the diagnosis and must not automatically be presented as total LCP duration.",
      "steps": [
        "Open this URL’s LCP breakdown in Lighthouse or a Performance trace. Record phases and their scope; if Argos did not retain them, consult the source.",
        "Identify the most costly phase before acting: document response, discovery, transfer or rendering. Choose an intervention matching that phase and the element actually observed.",
        "Compare the same phases and LCP over several loads with the same profile, then test the journey and rerun the audit."
      ],
      "expected": "The targeted phase decreases in comparable traces; separately confirm the change in total LCP duration and that the journey still works.",
      "example": "",
      "limits": "The diagnosis may be absent from historical measurements or another Lighthouse version. Its score alone supplies neither phase durations nor a demonstrated cause.",
      "summary": "Compare phases in the LCP trace and target the one actually consuming time. Separately verify the corrected phase and total LCP."
    }
  },
  {
    "keys": [
      "html.meta.description.present",
      "lighthouse.audit.meta-description"
    ],
    "reference": "https://developers.google.com/search/docs/appearance/snippet",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML contrôle une meta name=description avec un contenu non vide. Lighthouse examine le document rendu : les deux sources peuvent différer.",
      "steps": [
        "Repérer la meta description de cette URL dans <head>.",
        "Rédiger un résumé propre à cette page dans le champ de description ou le gabarit ; éviter les descriptions dupliquées.",
        "Contrôler le HTML reçu et le DOM rendu après rechargement."
      ],
      "expected": "La description existe, contient un résumé fidèle et reste lisible ; l’extrait choisi par un moteur peut être différent.",
      "example": "<meta name=\"description\" content=\"Découvrez les matières et dimensions des sacs de cet atelier.\">",
      "limits": "Ce contrôle ne prouve ni indexation ni positionnement dans les résultats."
    },
    "en": {
      "detection": "Argos HTML checks for a meta name=description with non-empty content. Lighthouse examines the rendered document: the two sources can differ.",
      "steps": [
        "Locate this URL’s meta description inside <head>.",
        "Write a page-specific summary in the description field or template; avoid duplicated descriptions.",
        "Check received HTML and rendered DOM after reloading."
      ],
      "expected": "The description exists, accurately summarises the page and reads naturally; a search engine may choose another snippet.",
      "example": "<meta name=\"description\" content=\"Explore the materials and dimensions of this studio’s bags.\">",
      "limits": "This check proves neither indexing nor search ranking."
    }
  },
  {
    "keys": [
      "html.link.canonical.present"
    ],
    "reference": "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTML cherche un lien rel=canonical dont href est exploitable en HTTP(S). Il ne confirme pas que le moteur retient cette URL.",
      "steps": [
        "Choisir la version qui doit représenter cette page et ses éventuels doublons.",
        "Renseigner une URL canonique cohérente avec les redirections, les liens internes et le sitemap.",
        "Ouvrir sa destination et vérifier qu’elle correspond bien au contenu attendu."
      ],
      "expected": "Le lien canonical n’est ni vide ni incohérent et sa destination est accessible.",
      "example": "<link rel=\"canonical\" href=\"https://example.com/collection/sacs\">",
      "limits": "Ne pas pointer toutes les pages vers l’accueil ; le choix canonique dépend du contenu."
    },
    "en": {
      "detection": "The HTML module looks for a rel=canonical link with a usable HTTP(S) href. It does not confirm that a search engine selects that URL.",
      "steps": [
        "Choose which version should represent this page and any duplicates.",
        "Set a canonical URL consistent with redirects, internal links and the sitemap.",
        "Open its destination and check that it matches the intended content."
      ],
      "expected": "The canonical link is non-empty and consistent, and its destination is accessible.",
      "example": "<link rel=\"canonical\" href=\"https://example.com/collection/bags\">",
      "limits": "Do not point every page to the homepage; canonical selection depends on content."
    }
  },
  {
    "keys": [
      "html.h1.count",
      "lighthouse.audit.heading-order"
    ],
    "reference": "https://www.w3.org/WAI/tutorials/page-structure/",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML compte les h1 et signale zéro ou plusieurs h1. Le contrôle Lighthouse heading-order porte sur l’ordre des niveaux de titres du DOM rendu.",
      "steps": [
        "Afficher la liste des titres dans les outils d’accessibilité du navigateur.",
        "Donner un titre principal au contenu et organiser les sous-titres selon leurs relations ; modifier les balises dans le gabarit, sans choisir un niveau pour sa taille visuelle.",
        "Reparcourir les titres avec un lecteur d’écran et au clavier."
      ],
      "expected": "Le sujet et l’organisation de la page se comprennent depuis ses titres.",
      "example": "<h1>Collection de sacs</h1>\n<h2>Matières et entretien</h2>",
      "limits": "Plusieurs h1 ne prouvent pas à eux seuls un défaut d’accessibilité ; examiner la structure réelle."
    },
    "en": {
      "detection": "Argos HTML counts h1 elements and flags zero or multiple h1 headings. Lighthouse heading-order concerns heading levels in the rendered DOM.",
      "steps": [
        "Display the heading list in browser accessibility tools.",
        "Give the content a main heading and organise subheadings by their relationships; edit template tags without choosing a level for its visual size.",
        "Navigate headings again with a screen reader and keyboard."
      ],
      "expected": "The page subject and organisation can be understood from its headings.",
      "example": "<h1>Bag collection</h1>\n<h2>Materials and care</h2>",
      "limits": "Multiple h1 headings alone do not prove an accessibility defect; inspect the actual structure."
    }
  },
  {
    "keys": [
      "lighthouse.audit.image-alt",
      "lighthouse.audit.input-image-alt",
      "lighthouse.audit.svg-img-alt"
    ],
    "reference": "https://www.w3.org/WAI/tutorials/images/",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML compte les img sans attribut alt dans le HTML reçu, même si alt vide est accepté. Lighthouse contrôle les alternatives dans le document rendu.",
      "steps": [
        "Retrouver les images signalées ; si aucun emplacement n’est conservé, examiner les img sans alt dans le DOM.",
        "Pour chaque image informative, écrire l’information utile dans alt. Pour une décoration, utiliser alt vide ; pour une image lien, expliquer la destination.",
        "Vérifier le nom accessible et relire le contenu avec un lecteur d’écran ; relancer ensuite le contrôle."
      ],
      "expected": "Chaque image a une alternative adaptée à sa fonction, confirmée par une revue humaine.",
      "example": "<img src=\"/decoration.svg\" alt=\"\">\n<img src=\"/sac.jpg\" alt=\"Sac bleu à anses courtes\">",
      "limits": "L’automatisation ne démontre pas qu’une image est informative ni que son alternative est pertinente."
    },
    "en": {
      "detection": "Argos HTML counts img elements without an alt attribute in received HTML, accepting empty alt. Lighthouse checks alternatives in the rendered document.",
      "steps": [
        "Locate the flagged images; if no location was retained, inspect img elements without alt in the DOM.",
        "For each informative image, write the useful information in alt. Use empty alt for decoration; explain the destination of a linked image.",
        "Check the accessible name and read the content with a screen reader; then repeat the check."
      ],
      "expected": "Each image has an alternative suited to its function, confirmed by human review.",
      "example": "<img src=\"/decoration.svg\" alt=\"\">\n<img src=\"/bag.jpg\" alt=\"Blue bag with short handles\">",
      "limits": "Automation does not establish whether an image is informative or its alternative meaningful."
    }
  },
  {
    "keys": [
      "html.anchors.href_coverage"
    ],
    "reference": "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML compte les éléments a dépourvus d’attribut href ; il ne vérifie pas leur destination ni leur nom accessible.",
      "steps": [
        "Retrouver les a sans href dans le HTML reçu.",
        "Pour une navigation, ajouter la destination réelle dans href ; pour une action sur la page, utiliser un bouton et son événement. Si cet élément sert seulement de repère de fragment (id ou name), conserver la cible : ne pas lui inventer une navigation.",
        "Activer chaque contrôle au clavier, puis vérifier la destination ou l’action."
      ],
      "expected": "La navigation est un lien utilisable et l’action est un bouton utilisable.",
      "example": "<a href=\"/contact\">Nous contacter</a>\n<button type=\"button\">Ouvrir les filtres</button>",
      "limits": "Un href présent mais vide ou erroné demande une vérification supplémentaire."
    },
    "en": {
      "detection": "Argos HTML counts a elements lacking an href attribute; it does not validate their destination or accessible name.",
      "steps": [
        "Locate a elements without href in received HTML.",
        "For navigation, add the real destination to href; for an in-page action, use a button and its handler. If this element is only a fragment target (id or name), preserve the target: do not invent navigation.",
        "Activate each control with the keyboard, then verify the destination or action."
      ],
      "expected": "Navigation is a usable link and an action is a usable button.",
      "example": "<a href=\"/contact\">Contact us</a>\n<button type=\"button\">Open filters</button>",
      "limits": "A present but empty or incorrect href needs an additional check."
    }
  },
  {
    "keys": [
      "lighthouse.audit.label",
      "lighthouse.audit.button-name",
      "lighthouse.audit.link-name",
      "lighthouse.audit.input-button-name",
      "lighthouse.audit.select-name"
    ],
    "reference": "https://www.w3.org/WAI/tutorials/forms/",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Lighthouse signale un contrôle dont il ne détermine pas le nom accessible, selon la règle identifiée dans ce constat.",
      "steps": [
        "Retrouver l’élément fourni dans les preuves et examiner son nom dans l’arbre d’accessibilité.",
        "Associer un label visible au champ avec for/id ; pour un bouton ou lien, donner un texte qui décrit son action. Utiliser aria-label lorsque le texte visible ne convient pas.",
        "Parcourir le formulaire au clavier et au lecteur d’écran, y compris les erreurs."
      ],
      "expected": "Chaque contrôle annonce sa fonction et conserve un libellé compréhensible pendant la saisie.",
      "example": "<label for=\"email\">Adresse e-mail</label>\n<input id=\"email\" type=\"email\" name=\"email\">",
      "limits": "La présence d’un nom ne prouve pas que ce nom est clair. Un placeholder ne remplace pas un libellé."
    },
    "en": {
      "detection": "Lighthouse flags a control whose accessible name it cannot determine, using the rule identified in this finding.",
      "steps": [
        "Locate the element in the retained evidence and inspect its name in the accessibility tree.",
        "Associate a visible label with the field using for/id; give buttons or links text describing their action. Use aria-label when visible text is unsuitable.",
        "Navigate the form by keyboard and screen reader, including errors."
      ],
      "expected": "Every control announces its function and retains an understandable label during entry.",
      "example": "<label for=\"email\">Email address</label>\n<input id=\"email\" type=\"email\" name=\"email\">",
      "limits": "A name’s presence does not prove clarity. A placeholder does not replace a label."
    }
  },
  {
    "keys": [
      "lighthouse.audit.color-contrast"
    ],
    "reference": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Lighthouse relève des couples texte/fond dont le contraste calculé ne satisfait pas sa règle, lorsque les couleurs sont déterminables.",
      "steps": [
        "Inspecter les couleurs calculées du texte et du fond des éléments signalés, avec les superpositions.",
        "Ajuster la couleur du texte ou du fond en conservant la hiérarchie visuelle ; ne pas transmettre le statut uniquement par la couleur.",
        "Remesurer le rapport de contraste et tester thèmes, survol, focus et erreurs."
      ],
      "expected": "Le contraste atteint le critère applicable au texte et à sa taille, confirmé sur le fond réel.",
      "example": "",
      "limits": "Des images de fond ou états dynamiques peuvent nécessiter un contrôle manuel supplémentaire."
    },
    "en": {
      "detection": "Lighthouse flags text/background pairs whose computed contrast fails its rule, when colours can be determined.",
      "steps": [
        "Inspect the flagged elements’ computed text and background colours, including overlays.",
        "Adjust text or background colour while retaining hierarchy; do not communicate status only through colour.",
        "Measure contrast again and test themes, hover, focus and errors."
      ],
      "expected": "Contrast meets the criterion applicable to the text and its size, confirmed on the actual background.",
      "example": "",
      "limits": "Background images or dynamic states may need additional manual checks."
    }
  },
  {
    "keys": [
      "html.lang",
      "lighthouse.audit.html-has-lang",
      "lighthouse.audit.html-lang-valid"
    ],
    "reference": "https://www.w3.org/WAI/tutorials/page-structure/",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML vérifie un attribut lang non vide sur html ; Lighthouse peut aussi contrôler la validité du code de langue.",
      "steps": [
        "Déterminer la langue principale réellement utilisée sur cette page.",
        "Renseigner un code de langue adapté sur html ; marquer les passages dans une autre langue avec leur propre lang.",
        "Inspecter le DOM rendu et écouter la prononciation avec le lecteur d’écran."
      ],
      "expected": "La langue déclarée correspond au contenu et aux changements de langue.",
      "example": "<html lang=\"fr\">",
      "limits": "La simple présence de lang ne garantit ni la validité du code ni sa correspondance avec le texte."
    },
    "en": {
      "detection": "Argos HTML checks for a non-empty lang attribute on html; Lighthouse may also check language-code validity.",
      "steps": [
        "Identify the language actually used for this page’s main content.",
        "Set a suitable language code on html; mark passages in another language with their own lang.",
        "Inspect the rendered DOM and listen to screen reader pronunciation."
      ],
      "expected": "The declared language matches the content and language changes.",
      "example": "<html lang=\"en\">",
      "limits": "The presence of lang guarantees neither code validity nor correspondence with the text."
    }
  },
  {
    "keys": [
      "html.meta.viewport.present",
      "lighthouse.audit.meta-viewport"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Multimedia",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML recherche une déclaration viewport exploitable ; Lighthouse contrôle le document rendu avec sa propre règle.",
      "steps": [
        "Examiner la balise viewport dans <head> et les styles aux petites largeurs.",
        "Utiliser la largeur du terminal puis adapter les mises en page qui débordent ; conserver le zoom utilisateur.",
        "Tester une largeur étroite et un agrandissement du texte sur un vrai parcours."
      ],
      "expected": "La page reste lisible et utilisable sans réduire artificiellement le zoom.",
      "example": "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "limits": "Cette balise seule ne rend pas la mise en page responsive."
    },
    "en": {
      "detection": "Argos HTML looks for a usable viewport declaration; Lighthouse checks the rendered document using its own rule.",
      "steps": [
        "Inspect the viewport tag in <head> and styles at small widths.",
        "Use device width, then adapt overflowing layouts; preserve user zoom.",
        "Test a narrow width and enlarged text on an actual journey."
      ],
      "expected": "The page remains readable and usable without artificially reducing zoom.",
      "example": "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "limits": "This tag alone does not make a layout responsive."
    }
  },
  {
    "keys": [
      "http.seo.robots_txt"
    ],
    "reference": "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP sonde robots.txt et conserve l’état de la réponse. Un fichier indisponible et un fichier absent sont des situations distinctes.",
      "steps": [
        "Ouvrir robots.txt à l’origine effectivement analysée et vérifier son statut.",
        "Modifier les règles selon les robots et chemins visés ; utiliser une authentification pour les données privées.",
        "Vérifier les règles appliquées à l’URL auditée et les outils du moteur concerné."
      ],
      "expected": "Les chemins utiles sont explorables selon l’intention ; les espaces privés ont un contrôle d’accès.",
      "example": "",
      "limits": "Un blocage robots.txt n’empêche pas à lui seul l’indexation d’une URL."
    },
    "en": {
      "detection": "The HTTP module probes robots.txt and retains its response state. An unavailable file and an absent file are distinct situations.",
      "steps": [
        "Open robots.txt at the actual analysed origin and inspect its status.",
        "Edit rules for the intended crawlers and paths; use authentication for private data.",
        "Check rules applying to the audited URL and the relevant search engine’s tools."
      ],
      "expected": "Useful paths are crawlable as intended; private areas have access control.",
      "example": "",
      "limits": "Blocking robots.txt alone does not prevent a URL from being indexed."
    }
  },
  {
    "keys": [
      "http.seo.sitemap"
    ],
    "reference": "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP sonde la ressource sitemap prévue par sa collecte ; ce contrôle ne constitue pas un inventaire de toutes les URL du site.",
      "steps": [
        "Vérifier l’URL de sitemap déclarée et son contenu XML.",
        "Inclure les URL canoniques souhaitées dans le sitemap généré ; retirer les redirections et les pages exclues intentionnellement.",
        "Contrôler la réponse du fichier et un échantillon de destinations."
      ],
      "expected": "Le sitemap est accessible et contient des URL cohérentes avec les pages à faire découvrir.",
      "example": "",
      "limits": "Un sitemap ne garantit ni exploration ni indexation ; certains petits sites n’en ont pas besoin."
    },
    "en": {
      "detection": "The HTTP module probes the sitemap resource used by collection; this check is not an inventory of every site URL.",
      "steps": [
        "Check the declared sitemap URL and its XML content.",
        "Include intended canonical URLs in the generated sitemap; remove redirects and intentionally excluded pages.",
        "Inspect the file response and a sample of destinations."
      ],
      "expected": "The sitemap is accessible and contains URLs consistent with the pages intended for discovery.",
      "example": "",
      "limits": "A sitemap guarantees neither crawling nor indexing; some small sites do not need one."
    }
  },
  {
    "keys": [
      "html.meta.robots.present",
      "lighthouse.audit.is-crawlable"
    ],
    "reference": "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML relève la présence d’une meta robots, sans valider l’intention d’indexation. Lighthouse is-crawlable recherche des restrictions d’indexation.",
      "steps": [
        "Confirmer si cette URL doit être indexée.",
        "Examiner meta robots et X-Robots-Tag ; conserver noindex pour une page volontairement privée de résultats, sans le confondre avec une authentification.",
        "Vérifier le HTML reçu, les en-têtes et l’intention dans les outils du moteur."
      ],
      "expected": "Les directives correspondent à l’intention de publication de cette URL.",
      "example": "",
      "limits": "L’absence de meta robots n’est pas une preuve de défaut. Aucun classement n’est prédit."
    },
    "en": {
      "detection": "Argos HTML records the presence of meta robots without validating indexing intent. Lighthouse is-crawlable looks for indexing restrictions.",
      "steps": [
        "Confirm whether this URL should be indexed.",
        "Inspect meta robots and X-Robots-Tag; retain noindex for pages intentionally excluded from results, without treating it as authentication.",
        "Check received HTML, headers and intent in the search engine’s tools."
      ],
      "expected": "Directives match the publication intent for this URL.",
      "example": "",
      "limits": "Missing meta robots is not proof of a defect. No ranking is predicted."
    }
  },
  {
    "keys": [
      "runtime.console.errors",
      "runtime.js.errors",
      "lighthouse.audit.errors-in-console"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Runtime compte les erreurs console du site (repli historique sur le total si attribution absente) et les exceptions pageerror séparément. Une erreur ne démontre pas sa cause.",
      "steps": [
        "Rejouer le chargement et le parcours avec la console ouverte ; retrouver le message et le script concernés.",
        "Activer l’arrêt sur exception si nécessaire, remonter à la source puis corriger la condition qui provoque l’erreur ; ne pas seulement masquer le message.",
        "Rejouer les fonctions concernées et comparer les compteurs dans le même contexte."
      ],
      "expected": "L’erreur ciblée ne se reproduit plus et la fonction attendue fonctionne, y compris en cas d’échec d’un fournisseur.",
      "example": "",
      "limits": "L’attribution à un tiers et les échantillons peuvent être incomplets ; les détails absents ne permettent pas de nommer un fichier."
    },
    "en": {
      "detection": "Runtime counts site console errors (historically falling back to the total if attribution is absent) and pageerror exceptions separately. An error does not establish its cause.",
      "steps": [
        "Replay loading and the journey with the console open; locate the message and affected script.",
        "Enable pause on exceptions if needed, trace the source and fix the condition causing the error; do not merely hide the message.",
        "Replay affected features and compare counters in the same context."
      ],
      "expected": "The targeted error no longer occurs and the intended feature works, including when a provider fails.",
      "example": "",
      "limits": "Third-party attribution and samples may be incomplete; absent details cannot identify a file."
    }
  },
  {
    "keys": [
      "runtime.network.5xx",
      "runtime.network.failed_requests",
      "runtime.network.third_party_errors"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Runtime distingue réponses 5xx et requêtes interrompues, ainsi que site et tiers lorsque l’attribution est disponible. Ces compteurs ne sont pas interchangeables.",
      "steps": [
        "Ouvrir le panneau Réseau sur le même parcours et retrouver les statuts ou raisons d’échec conservés.",
        "Pour un 5xx, corréler avec les journaux serveur ; pour une requête interrompue, vérifier le motif navigateur, DNS, TLS ou CORS avant de modifier la ressource.",
        "Corriger la cause reproduite puis vérifier la réponse et la fonction qui utilise la ressource."
      ],
      "expected": "La requête ciblée aboutit au statut attendu et le parcours fonctionne ; un tiers indisponible a un repli adapté.",
      "example": "",
      "limits": "La source et l’initiateur peuvent être absents ; ne pas déduire une panne serveur d’un simple échec navigateur."
    },
    "en": {
      "detection": "Runtime distinguishes 5xx responses from interrupted requests, and site from third party when attribution is available. These counters are not interchangeable.",
      "steps": [
        "Open the Network panel on the same journey and locate retained statuses or failure reasons.",
        "For 5xx, correlate with server logs; for an interrupted request, inspect browser, DNS, TLS or CORS reasons before changing the resource.",
        "Fix the reproduced cause, then check the response and the feature consuming the resource."
      ],
      "expected": "The targeted request returns the expected status and the journey works; an unavailable third party has a suitable fallback.",
      "example": "",
      "limits": "Source and initiator may be absent; do not infer a server outage from a browser failure."
    }
  },
  {
    "keys": [
      "runtime.network.request_count"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Runtime compte les requêtes de la navigation observée. Le collecteur actuel signale plus de 120 requêtes ; ce seuil Argos est indicatif.",
      "steps": [
        "Trier la cascade réseau par type et initiateur pour repérer les chargements redondants.",
        "Retirer un chargement sans usage démontré ou différer une fonctionnalité hors du premier parcours ; conserver ses dépendances.",
        "Comparer le nombre de requêtes à cache et parcours identiques, puis tester les fonctions différées."
      ],
      "expected": "Les requêtes inutiles ciblées ont disparu et les fonctionnalités restent disponibles.",
      "example": "",
      "limits": "Un nombre élevé ne démontre pas à lui seul un temps de chargement excessif."
    },
    "en": {
      "detection": "Runtime counts requests in the observed navigation. The current collector flags more than 120 requests; this Argos threshold is indicative.",
      "steps": [
        "Sort the network waterfall by type and initiator to locate redundant loading.",
        "Remove a load with no demonstrated use or defer a feature outside the first journey; retain its dependencies.",
        "Compare request counts with identical cache and journey settings, then test deferred features."
      ],
      "expected": "The targeted unnecessary requests are gone and features remain available.",
      "example": "",
      "limits": "A high count alone does not establish excessive loading time."
    }
  },
  {
    "keys": [
      "runtime.network.bytes_estimated"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Multimedia",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Runtime estime les octets à partir des longueurs disponibles. Le collecteur actuel signale plus de 3 000 000 octets ; une longueur manquante rend le total inconnu.",
      "steps": [
        "Trier les transferts par taille et confirmer les ressources réellement lourdes.",
        "Adapter dimensions et formats des images, puis examiner scripts et polices ; comparer qualité et usages avant suppression.",
        "Mesurer les octets réellement transférés dans le navigateur, avec le même cache et le même parcours."
      ],
      "expected": "Le transfert ciblé baisse sans perte visuelle ou fonctionnelle ; les valeurs inconnues restent inconnues.",
      "example": "",
      "limits": "L’estimation Content-Length ne constitue pas une mesure complète des octets réseau."
    },
    "en": {
      "detection": "Runtime estimates bytes from available lengths. The current collector flags more than 3,000,000 bytes; missing lengths make the total unknown.",
      "steps": [
        "Sort transfers by size and confirm which resources are actually large.",
        "Adapt image dimensions and formats, then review scripts and fonts; compare quality and usage before removing anything.",
        "Measure bytes actually transferred in the browser with the same cache and journey."
      ],
      "expected": "The targeted transfer decreases without visual or functional loss; unknown values remain unknown.",
      "example": "",
      "limits": "The Content-Length estimate is not a complete network byte measurement."
    }
  },
  {
    "keys": [
      "lighthouse.audit.cumulative-layout-shift",
      "lighthouse.audit.cls-culprits-insight",
      "lighthouse.audit.unsized-images"
    ],
    "reference": "https://web.dev/articles/optimize-cls",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Lighthouse produit un signal de stabilité ou de dimensions d’images. Le score normalisé de l’audit n’est pas la valeur CLS.",
      "steps": [
        "Enregistrer le chargement puis les interactions dans une trace avec les déplacements de mise en page.",
        "Réserver la taille des images, publicités et intégrations réellement responsables ; vérifier les polices de repli.",
        "Rejouer avec chargement lent et interactions pour contrôler la stabilité visuelle."
      ],
      "expected": "Les déplacements identifiés disparaissent sans masquer du contenu ni empêcher son chargement.",
      "example": "<img src=\"/illustration.jpg\" width=\"800\" height=\"600\" alt=\"\">",
      "limits": "L’élément qui se déplace n’est pas toujours celui qui provoque le déplacement."
    },
    "en": {
      "detection": "Lighthouse supplies a stability or image-dimension signal. The audit’s normalised score is not the CLS value.",
      "steps": [
        "Record loading and interactions in a trace showing layout shifts.",
        "Reserve space for images, adverts and embeds actually responsible; check fallback fonts.",
        "Replay with slow loading and interactions to inspect visual stability."
      ],
      "expected": "Identified shifts disappear without hiding content or preventing loading.",
      "example": "<img src=\"/illustration.jpg\" width=\"800\" height=\"600\" alt=\"\">",
      "limits": "The element that moves is not always the element causing the shift."
    }
  },
  {
    "keys": [
      "lighthouse.audit.unused-javascript",
      "lighthouse.audit.unused-css",
      "lighthouse.audit.unused-css-rules"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Lighthouse signale des ressources bloquantes ou du code inutilisé pendant son scénario. Cela ne démontre pas qu’une ressource est inutile sur tous les parcours.",
      "steps": [
        "Retrouver la ressource dans la cascade et mesurer sa couverture pendant le parcours signalé.",
        "Séparer le code du premier affichage du code différé ; tester un retrait, un découpage ou un chargement différé sur la ressource identifiée.",
        "Tester menus, formulaires, thèmes et chargements à la demande avant de comparer les transferts et le premier affichage."
      ],
      "expected": "Le coût ciblé diminue et les fonctions qui utilisent ce code restent opérationnelles.",
      "example": "",
      "limits": "Ne pas appliquer async indistinctement à des scripts dépendants ; les états non visités peuvent utiliser le code signalé."
    },
    "en": {
      "detection": "Lighthouse flags blocking resources or code unused during its scenario. This does not establish that a resource is unnecessary on every journey.",
      "steps": [
        "Locate the resource in the waterfall and measure coverage during the flagged journey.",
        "Separate initial-render code from deferred code; test removal, splitting or deferred loading for the identified resource.",
        "Test menus, forms, themes and on-demand loading before comparing transfers and initial rendering."
      ],
      "expected": "The targeted overhead decreases and features using this code remain operational.",
      "example": "",
      "limits": "Do not apply async indiscriminately to dependent scripts; unvisited states may use the flagged code."
    }
  },
  {
    "keys": [
      "http.security.hsts"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le collecteur HTTP actuel recherche Strict-Transport-Security sur la réponse finale et vérifie un max-age positif reconnu. Une mesure issue de ZAP peut appliquer une autre règle.",
      "steps": [
        "Lire la valeur réellement reçue dans le panneau Réseau, sans se limiter à la configuration du serveur.",
        "Vérifier HTTPS sur les hôtes concernés avant d’étendre aux sous-domaines.",
        "Configurer Strict-Transport-Security au point qui produit la réponse (application, proxy ou CDN), puis tester les fonctions et les réponses concernées."
      ],
      "expected": "L’en-tête reçu correspond à la politique choisie et les parcours légitimes continuent de fonctionner.",
      "example": "Strict-Transport-Security: max-age=300",
      "limits": "Le validateur reconnaît un sous-ensemble de configurations ; une valeur non reconnue n’est pas une preuve d’exploitation. L’exemple demande adaptation."
    },
    "en": {
      "detection": "The current HTTP collector looks for Strict-Transport-Security on the final response and checks for a recognised positive max-age. A ZAP-sourced measurement may use another rule.",
      "steps": [
        "Read the value actually received in the Network panel, rather than relying only on server configuration.",
        "Check HTTPS on affected hosts before extending to subdomains.",
        "Configure Strict-Transport-Security where the response is produced (application, proxy or CDN), then test affected features and responses."
      ],
      "expected": "The received header matches the chosen policy and legitimate journeys continue to work.",
      "example": "Strict-Transport-Security: max-age=300",
      "limits": "The validator recognises a subset of configurations; an unrecognised value is not proof of exploitation. The example needs adaptation."
    }
  },
  {
    "keys": [
      "http.security.x_frame_options"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le collecteur HTTP actuel recherche X-Frame-Options sur la réponse finale et vérifie DENY, SAMEORIGIN ou un frame-ancestors restrictif reconnu. Une mesure issue de ZAP peut appliquer une autre règle.",
      "steps": [
        "Lire la valeur réellement reçue dans le panneau Réseau, sans se limiter à la configuration du serveur.",
        "Recenser les intégrations légitimes et choisir les origines autorisées à intégrer cette page.",
        "Configurer X-Frame-Options au point qui produit la réponse (application, proxy ou CDN), puis tester les fonctions et les réponses concernées."
      ],
      "expected": "L’en-tête reçu correspond à la politique choisie et les parcours légitimes continuent de fonctionner.",
      "example": "X-Frame-Options: SAMEORIGIN",
      "limits": "Le validateur reconnaît un sous-ensemble de configurations ; une valeur non reconnue n’est pas une preuve d’exploitation. L’exemple demande adaptation."
    },
    "en": {
      "detection": "The current HTTP collector looks for X-Frame-Options on the final response and checks for DENY, SAMEORIGIN or a recognised restrictive frame-ancestors. A ZAP-sourced measurement may use another rule.",
      "steps": [
        "Read the value actually received in the Network panel, rather than relying only on server configuration.",
        "List legitimate embeds and choose which origins may embed this page.",
        "Configure X-Frame-Options where the response is produced (application, proxy or CDN), then test affected features and responses."
      ],
      "expected": "The received header matches the chosen policy and legitimate journeys continue to work.",
      "example": "X-Frame-Options: SAMEORIGIN",
      "limits": "The validator recognises a subset of configurations; an unrecognised value is not proof of exploitation. The example needs adaptation."
    }
  },
  {
    "keys": [
      "http.security.x_content_type_options"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le collecteur HTTP actuel recherche X-Content-Type-Options sur la réponse finale et vérifie la valeur nosniff. Une mesure issue de ZAP peut appliquer une autre règle.",
      "steps": [
        "Lire la valeur réellement reçue dans le panneau Réseau, sans se limiter à la configuration du serveur.",
        "Corriger les types MIME des ressources avant d’activer nosniff.",
        "Configurer X-Content-Type-Options au point qui produit la réponse (application, proxy ou CDN), puis tester les fonctions et les réponses concernées."
      ],
      "expected": "L’en-tête reçu correspond à la politique choisie et les parcours légitimes continuent de fonctionner.",
      "example": "X-Content-Type-Options: nosniff",
      "limits": "Le validateur reconnaît un sous-ensemble de configurations ; une valeur non reconnue n’est pas une preuve d’exploitation. L’exemple demande adaptation."
    },
    "en": {
      "detection": "The current HTTP collector looks for X-Content-Type-Options on the final response and checks for the nosniff value. A ZAP-sourced measurement may use another rule.",
      "steps": [
        "Read the value actually received in the Network panel, rather than relying only on server configuration.",
        "Fix resource MIME types before enabling nosniff.",
        "Configure X-Content-Type-Options where the response is produced (application, proxy or CDN), then test affected features and responses."
      ],
      "expected": "The received header matches the chosen policy and legitimate journeys continue to work.",
      "example": "X-Content-Type-Options: nosniff",
      "limits": "The validator recognises a subset of configurations; an unrecognised value is not proof of exploitation. The example needs adaptation."
    }
  },
  {
    "keys": [
      "http.security.referrer_policy"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le collecteur HTTP actuel recherche Referrer-Policy sur la réponse finale et vérifie une politique reconnue différente de unsafe-url. Une mesure issue de ZAP peut appliquer une autre règle.",
      "steps": [
        "Lire la valeur réellement reçue dans le panneau Réseau, sans se limiter à la configuration du serveur.",
        "Choisir les informations de référent nécessaires aux destinations externes et aux intégrations.",
        "Configurer Referrer-Policy au point qui produit la réponse (application, proxy ou CDN), puis tester les fonctions et les réponses concernées."
      ],
      "expected": "L’en-tête reçu correspond à la politique choisie et les parcours légitimes continuent de fonctionner.",
      "example": "Referrer-Policy: strict-origin-when-cross-origin",
      "limits": "Le validateur reconnaît un sous-ensemble de configurations ; une valeur non reconnue n’est pas une preuve d’exploitation. L’exemple demande adaptation."
    },
    "en": {
      "detection": "The current HTTP collector looks for Referrer-Policy on the final response and checks for a recognised policy other than unsafe-url. A ZAP-sourced measurement may use another rule.",
      "steps": [
        "Read the value actually received in the Network panel, rather than relying only on server configuration.",
        "Choose which referrer information is needed for external destinations and integrations.",
        "Configure Referrer-Policy where the response is produced (application, proxy or CDN), then test affected features and responses."
      ],
      "expected": "The received header matches the chosen policy and legitimate journeys continue to work.",
      "example": "Referrer-Policy: strict-origin-when-cross-origin",
      "limits": "The validator recognises a subset of configurations; an unrecognised value is not proof of exploitation. The example needs adaptation."
    }
  },
  {
    "keys": [
      "http.security.permissions_policy"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le collecteur HTTP actuel recherche Permissions-Policy sur la réponse finale et vérifie au moins une capacité connue avec une liste restrictive. Une mesure issue de ZAP peut appliquer une autre règle.",
      "steps": [
        "Lire la valeur réellement reçue dans le panneau Réseau, sans se limiter à la configuration du serveur.",
        "Recenser les usages caméra, micro ou géolocalisation avant de restreindre leurs origines.",
        "Configurer Permissions-Policy au point qui produit la réponse (application, proxy ou CDN), puis tester les fonctions et les réponses concernées."
      ],
      "expected": "L’en-tête reçu correspond à la politique choisie et les parcours légitimes continuent de fonctionner.",
      "example": "Permissions-Policy: camera=(), microphone=()",
      "limits": "Le validateur reconnaît un sous-ensemble de configurations ; une valeur non reconnue n’est pas une preuve d’exploitation. L’exemple demande adaptation."
    },
    "en": {
      "detection": "The current HTTP collector looks for Permissions-Policy on the final response and checks for at least one known capability with a restrictive allowlist. A ZAP-sourced measurement may use another rule.",
      "steps": [
        "Read the value actually received in the Network panel, rather than relying only on server configuration.",
        "List camera, microphone or geolocation uses before restricting their origins.",
        "Configure Permissions-Policy where the response is produced (application, proxy or CDN), then test affected features and responses."
      ],
      "expected": "The received header matches the chosen policy and legitimate journeys continue to work.",
      "example": "Permissions-Policy: camera=(), microphone=()",
      "limits": "The validator recognises a subset of configurations; an unrecognised value is not proof of exploitation. The example needs adaptation."
    }
  },
  {
    "keys": [
      "http.security.cookie_flags"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le collecteur HTTP actuel recherche Secure et HttpOnly sur chaque Set-Cookie observé. Il ne valide pas SameSite et ne publie pas les valeurs des cookies.",
      "steps": [
        "Examiner les attributs de chaque cookie dans les outils du navigateur, sans copier ses secrets dans un ticket.",
        "Ajouter Secure aux cookies transmis en HTTPS et HttpOnly aux cookies sensibles ; documenter les exceptions nécessitant JavaScript.",
        "Choisir SameSite selon le parcours, puis tester connexion, paiement et intégrations entre sites."
      ],
      "expected": "Les cookies sensibles portent les attributs adaptés et les parcours de session restent fonctionnels.",
      "example": "",
      "limits": "Un cookie accessible au JavaScript peut être intentionnel ; le contrôle demande une revue de son usage."
    },
    "en": {
      "detection": "The current HTTP collector checks each observed Set-Cookie for Secure and HttpOnly. It does not validate SameSite or publish cookie values.",
      "steps": [
        "Inspect each cookie’s attributes in browser tools without copying its secrets into a ticket.",
        "Add Secure to cookies sent over HTTPS and HttpOnly to sensitive cookies; document exceptions requiring JavaScript.",
        "Choose SameSite for the journey, then test sign-in, checkout and cross-site integrations."
      ],
      "expected": "Sensitive cookies carry suitable attributes and session journeys remain functional.",
      "example": "",
      "limits": "A JavaScript-readable cookie may be intentional; the check requires a review of its purpose."
    }
  },
  {
    "keys": [
      "ssl.grade",
      "ssl.certificate.valid",
      "ssl.certificate.expiry_days",
      "ssl.protocols.tls12",
      "ssl.protocols.tls13",
      "ssl.protocols.legacy_disabled"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "SSL Labs examine des points de terminaison TLS. La note, la validité du certificat, son expiration et les protocoles sont des observations distinctes ; la couverture peut être partielle.",
      "steps": [
        "Retrouver le point de terminaison et la propriété concernés dans la preuve SSL Labs ; ne pas déduire un certificat invalide d’une simple note agrégée.",
        "Pour un certificat, contrôler noms d’hôte, chaîne et renouvellement ; pour un protocole, adapter les versions acceptées après revue des clients à supporter.",
        "Vérifier chaque point de terminaison, le certificat réellement servi et les clients concernés, puis relancer SSL Labs."
      ],
      "expected": "La propriété ciblée est corrigée sur tous les points concernés ; les points non mesurés restent à vérifier.",
      "example": "",
      "limits": "Une mesure TLS ne prouve pas la sécurité du contenu. Une note agrégée demande le diagnostic détaillé avant de choisir une correction."
    },
    "en": {
      "detection": "SSL Labs examines TLS endpoints. Grade, certificate validity, expiry and protocols are separate observations; coverage can be partial.",
      "steps": [
        "Locate the endpoint and property in SSL Labs evidence; do not infer an invalid certificate from an aggregate grade alone.",
        "For a certificate, check hostnames, chain and renewal; for a protocol, adapt accepted versions after reviewing clients that must be supported.",
        "Check each endpoint, the certificate actually served and affected clients, then repeat SSL Labs."
      ],
      "expected": "The targeted property is fixed on all affected endpoints; unmeasured endpoints still need checking.",
      "example": "",
      "limits": "A TLS measurement does not prove content security. An aggregate grade requires detailed diagnosis before choosing a fix."
    }
  },
  {
    "keys": [
      "lighthouse.score.performance",
      "lighthouse.score.accessibility",
      "lighthouse.score.best-practices",
      "lighthouse.score.seo"
    ],
    "reference": "https://developer.chrome.com/docs/lighthouse/performance/performance-scoring",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos conserve une note de catégorie Lighthouse sur 100 ; le collecteur actuel signale une note inférieure à 85. Cette note regroupe plusieurs contrôles.",
      "steps": [
        "Ouvrir les constats détaillés de cette catégorie et choisir un problème étayé par une preuve.",
        "Si aucun détail n’est conservé, demander le diagnostic Lighthouse source avant de choisir ou chiffrer une correction.",
        "Corriger le contrôle identifié puis comparer sa mesure et la note sur plusieurs exécutions avec le même profil."
      ],
      "expected": "Le contrôle ciblé est vérifié individuellement ; la variation de la note seule ne valide pas une correction.",
      "example": "",
      "limits": "Une note agrégée n’est ni un défaut unique ni une certification d’accessibilité ou de sécurité."
    },
    "en": {
      "detection": "Argos retains a Lighthouse category score out of 100; the current collector flags scores below 85. This score combines several checks.",
      "steps": [
        "Open detailed findings for this category and choose a problem supported by evidence.",
        "If no details were retained, request the source Lighthouse diagnosis before selecting or estimating a fix.",
        "Fix the identified check, then compare its measurement and the score over several runs using the same profile."
      ],
      "expected": "The targeted check is verified individually; score variation alone does not validate a fix.",
      "example": "",
      "limits": "An aggregate score is neither a single defect nor accessibility or security certification."
    }
  },
  {
    "keys": [
      "observatory.score"
    ],
    "reference": "https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos conserve la note agrégée fournie par Observatory. Cette note peut porter un périmètre différent de la page et de la réponse HTTP analysées directement.",
      "steps": [
        "Lire les sous-tests et la date du diagnostic Observatory source.",
        "Choisir un en-tête réellement signalé, comparer la réponse concernée et préparer une politique compatible avec les usages du site.",
        "Inspecter l’en-tête reçu et relancer le sous-test ainsi que les parcours légitimes."
      ],
      "expected": "Le sous-test ciblé et la réponse réelle concordent ; une note seule ne démontre pas une vulnérabilité.",
      "example": "",
      "limits": "Si les sous-tests, la date ou le périmètre sont absents, demander le diagnostic source avant d’attribuer une cause."
    },
    "en": {
      "detection": "Argos retains the aggregate score supplied by Observatory. Its scope may differ from the page and HTTP response inspected directly.",
      "steps": [
        "Read the source Observatory diagnosis’s subtests and date.",
        "Choose a header actually flagged, compare the relevant response and prepare a policy compatible with site usage.",
        "Inspect the received header and repeat the subtest as well as legitimate journeys."
      ],
      "expected": "The targeted subtest and actual response agree; a score alone does not demonstrate a vulnerability.",
      "example": "",
      "limits": "If subtests, date or scope are absent, request the source diagnosis before attributing a cause."
    }
  },
  {
    "keys": [
      "tech.security.version_disclosure"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module technique recherche des motifs de version dans Server et X-Powered-By. Un numéro exposé n’est pas la preuve d’une vulnérabilité.",
      "steps": [
        "Vérifier quel composant émet la bannière sur la réponse publique.",
        "Supprimer les versions inutiles au niveau qui produit la réponse et maintenir le logiciel à jour ; masquer une version ne corrige pas une faille.",
        "Recharger la réponse publique et contrôler la version installée dans l’administration du composant."
      ],
      "expected": "La bannière inutile a disparu et la version réellement exécutée est maintenue.",
      "example": "",
      "limits": "Un proxy peut modifier les en-têtes ; la technologie ou sa version ne doit pas être déduite de ce seul signal."
    },
    "en": {
      "detection": "The technical module looks for version patterns in Server and X-Powered-By. An exposed number is not proof of a vulnerability.",
      "steps": [
        "Check which component emits the banner on the public response.",
        "Remove unnecessary versions where the response is produced and keep software updated; hiding a version does not fix a flaw.",
        "Reload the public response and inspect the installed version in the component’s administration."
      ],
      "expected": "The unnecessary banner is removed and the version actually running is maintained.",
      "example": "",
      "limits": "A proxy may change headers; technology or version must not be inferred from this signal alone."
    }
  },
  {
    "keys": [
      "http.final_url.https",
      "http.redirect.to_https"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP suit les redirections et examine le schéma final ; la redirection HTTP vers HTTPS n’est pas applicable si l’entrée est déjà HTTPS.",
      "steps": [
        "Vérifier le certificat de la destination et les chemins réellement utilisés avant d’activer la redirection.",
        "Configurer une redirection vers la même page en HTTPS puis tester accès direct, liens et formulaires."
      ],
      "expected": "Le parcours arrive sur la page HTTPS attendue sans boucle et sans contenu essentiel bloqué.",
      "example": "",
      "limits": "HTTPS protège le transport ; cela ne valide pas la sécurité de l’application."
    },
    "en": {
      "detection": "The HTTP module follows redirects and examines the final scheme; HTTP-to-HTTPS redirection is not applicable when input already uses HTTPS.",
      "steps": [
        "Check the destination certificate and actual paths before enabling redirection.",
        "Configure a redirect to the same page over HTTPS, then test direct access, links and forms."
      ],
      "expected": "The journey reaches the intended HTTPS page without loops or blocked essential content.",
      "example": "",
      "limits": "HTTPS protects transport; it does not validate application security."
    }
  },
  {
    "keys": [
      "http.status_code",
      "http.errors"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP conserve le statut de la réponse finale et les incidents du parcours. Un échec de transport n’est pas une réponse 5xx du site.",
      "steps": [
        "Rejouer l’URL exacte et distinguer statut HTTP reçu, DNS, TLS, délai dépassé ou redirection incorrecte.",
        "Pour une réponse erronée, corréler l’heure avec les journaux du composant qui l’émet et corriger la cause reproduite."
      ],
      "expected": "La requête retourne le statut prévu pour cette page et son contenu est le bon.",
      "example": "",
      "limits": "Un blocage anti-bot ou une indisponibilité du collecteur limite la conclusion sur la page attendue."
    },
    "en": {
      "detection": "The HTTP module retains the final response status and navigation incidents. A transport failure is not a site 5xx response.",
      "steps": [
        "Replay the exact URL and distinguish a received HTTP status from DNS, TLS, timeout or incorrect redirect.",
        "For an erroneous response, correlate its time with logs of the component emitting it and fix the reproduced cause."
      ],
      "expected": "The request returns this page’s expected status and intended content.",
      "example": "",
      "limits": "An anti-bot challenge or unavailable collector limits conclusions about the intended page."
    }
  },
  {
    "keys": [
      "http.redirect.count"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le collecteur actuel compte les redirections : jusqu’à deux sont acceptées, trois à cinq sont signalées et plus de cinq produisent un échec.",
      "steps": [
        "Reconstituer la chaîne de destinations et repérer les passages inutiles entre domaine, schéma et chemin.",
        "Faire pointer les liens et redirections vers la destination finale voulue puis tester les anciennes URL."
      ],
      "expected": "La chaîne ciblée est raccourcie sans boucle ni perte de destination.",
      "example": "",
      "limits": "Ce seuil est propre à Argos et ne mesure pas à lui seul la durée du parcours."
    },
    "en": {
      "detection": "The current collector counts redirects: up to two are accepted, three to five are flagged and more than five fail.",
      "steps": [
        "Reconstruct the destination chain and locate unnecessary domain, scheme or path transitions.",
        "Point links and redirects to the intended final destination, then test old URLs."
      ],
      "expected": "The targeted chain is shorter without loops or lost destinations.",
      "example": "",
      "limits": "This Argos threshold alone does not measure journey duration."
    }
  },
  {
    "keys": [
      "http.headers.content_type"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le contrôle HTTP actuel vérifie la présence de Content-Type ; il ne valide pas entièrement la correspondance entre MIME et contenu.",
      "steps": [
        "Comparer le type reçu avec le contenu réellement renvoyé pour cette URL.",
        "Corriger le routage ou le Content-Type au niveau qui sert la ressource ; tester aussi CSS, scripts et pages d’erreur."
      ],
      "expected": "Le navigateur reçoit un type cohérent avec chaque ressource et les chargements restent fonctionnels.",
      "example": "",
      "limits": "Un en-tête présent n’est pas une preuve de type correct."
    },
    "en": {
      "detection": "The current HTTP check tests Content-Type presence; it does not fully validate the MIME/content match.",
      "steps": [
        "Compare the received type with the content actually returned for this URL.",
        "Fix routing or Content-Type where the resource is served; also test CSS, scripts and error pages."
      ],
      "expected": "The browser receives a type consistent with each resource and loading remains functional.",
      "example": "",
      "limits": "A present header does not prove the type is correct."
    }
  },
  {
    "keys": [
      "http.headers.compression"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP relève Content-Encoding sur le document reçu. Son absence est une observation, pas une preuve de panne ni une mesure manquante.",
      "steps": [
        "Examiner les octets transférés et l’en-tête avec les encodages réellement acceptés par le client.",
        "Si le texte volumineux le justifie, activer une compression compatible au serveur ou au proxy et contrôler Vary/Accept-Encoding."
      ],
      "expected": "La variante compressée se décode correctement et le transfert baisse dans un test comparable.",
      "example": "",
      "limits": "Le collecteur ne fournit pas ici un inventaire de toutes les ressources compressées."
    },
    "en": {
      "detection": "The HTTP module records Content-Encoding on the received document. Absence is an observation, not proof of failure or a missing measurement.",
      "steps": [
        "Inspect transferred bytes and the header using encodings actually accepted by the client.",
        "If large text warrants it, enable compatible compression on the server or proxy and check Vary/Accept-Encoding."
      ],
      "expected": "The compressed variant decodes correctly and transfer decreases in a comparable test.",
      "example": "",
      "limits": "The collector does not supply an inventory of all compressed resources here."
    }
  },
  {
    "keys": [
      "http.headers.caching"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP relève Cache-Control et Expires sur le document HTML. Le contrôle est informatif : l’absence de cache peut être intentionnelle.",
      "steps": [
        "Distinguer contenu personnalisé et ressources statiques publiques avant de définir une durée.",
        "Définir la politique pour chaque type de réponse puis vérifier les accès successifs et la revalidation."
      ],
      "expected": "Les ressources réutilisables sont mises en cache selon l’intention et le contenu privé ne fuit pas vers un cache partagé.",
      "example": "",
      "limits": "Ne pas imposer un cache public au HTML personnalisé pour améliorer un score."
    },
    "en": {
      "detection": "The HTTP module records Cache-Control and Expires on the HTML document. This check is informational: absent caching may be intentional.",
      "steps": [
        "Distinguish personalised content from public static resources before choosing a duration.",
        "Set the policy for each response type, then check repeat accesses and revalidation."
      ],
      "expected": "Reusable resources are cached as intended and private content does not leak into a shared cache.",
      "example": "",
      "limits": "Do not impose public caching on personalised HTML to improve a score."
    }
  },
  {
    "keys": [
      "http.headers.server"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP relève la présence ou l’absence de Server. L’absence est une observation complète de cet en-tête, pas une indisponibilité.",
      "steps": [
        "Vérifier si la bannière contient une version et quel composant l’ajoute.",
        "Retirer les informations inutiles si cela est possible, puis confirmer que la version installée est maintenue."
      ],
      "expected": "La réponse expose seulement les informations voulues et le logiciel reste à jour.",
      "example": "",
      "limits": "La présence de Server seule n’établit pas une vulnérabilité ni la technologie réelle derrière un proxy."
    },
    "en": {
      "detection": "The HTTP module records whether Server is present. Absence is a complete observation of this header, not unavailability.",
      "steps": [
        "Check whether the banner includes a version and which component adds it.",
        "Remove unnecessary information where possible, then confirm the installed version is maintained."
      ],
      "expected": "The response exposes only intended information and software remains updated.",
      "example": "",
      "limits": "Server presence alone establishes neither a vulnerability nor actual technology behind a proxy."
    }
  },
  {
    "keys": [
      "http.protocol.http2",
      "http.protocol.version"
    ],
    "reference": "https://web.dev/articles/optimize-lcp",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP conserve la version négociée par son client. Le signal HTTP/2 compare cette négociation à HTTP_2 ou HTTP_3 en HTTPS.",
      "steps": [
        "Reproduire la négociation HTTPS avec un client compatible et vérifier le proxy ou CDN qui termine la connexion.",
        "Activer le protocole compatible si utile, puis comparer la négociation et la cascade sans supposer un gain garanti."
      ],
      "expected": "La version attendue est négociée et les ressources se chargent correctement.",
      "example": "",
      "limits": "Le protocole observé dépend du client, du réseau et du point de terminaison."
    },
    "en": {
      "detection": "The HTTP module records the version negotiated by its client. The HTTP/2 signal compares this with HTTP_2 or HTTP_3 over HTTPS.",
      "steps": [
        "Repeat HTTPS negotiation with a compatible client and inspect the proxy or CDN terminating the connection.",
        "Enable the compatible protocol where useful, then compare negotiation and waterfall without assuming a guaranteed gain."
      ],
      "expected": "The expected version is negotiated and resources load correctly.",
      "example": "",
      "limits": "The observed protocol depends on client, network and endpoint."
    }
  },
  {
    "keys": [
      "http.antibot.challenge"
    ],
    "reference": "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTTP relève des marqueurs de page de vérification ou un en-tête de challenge ; un CDN seul ne suffit pas à confirmer le blocage.",
      "steps": [
        "Confirmer que le contenu reçu est une page de vérification et non la page demandée.",
        "Convenir avec le propriétaire des conditions d’un audit autorisé puis relancer la mesure."
      ],
      "expected": "L’analyse observe le contenu prévu ; les contrôles auparavant bloqués sont réexaminés.",
      "example": "",
      "limits": "Ce blocage limite la mesure et ne démontre pas un défaut de la page visée."
    },
    "en": {
      "detection": "The HTTP module detects verification-page markers or a challenge header; a CDN alone does not confirm blocking.",
      "steps": [
        "Confirm that the received content is a challenge rather than the requested page.",
        "Agree authorised auditing conditions with the owner, then repeat measurement."
      ],
      "expected": "The analysis observes intended content; previously blocked checks are measured again.",
      "example": "",
      "limits": "Blocking limits measurement and does not establish a defect in the intended page."
    }
  },
  {
    "keys": [
      "http.response_time_ms",
      "html.analysis.duration_ms",
      "runtime.analysis.duration_ms"
    ],
    "reference": "https://web.dev/articles/vitals",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Cette durée décrit le travail du collecteur ; le temps HTTP inclut le parcours réseau et les redirections. Ce n’est pas un temps d’affichage ressenti.",
      "steps": [
        "Relever les conditions réseau et le périmètre du collecteur avant comparaison.",
        "Pour étudier l’expérience visiteur, examiner les mesures de rendu et une trace du navigateur plutôt que modifier le site à partir de cette durée seule."
      ],
      "expected": "Les comparaisons utilisent la même méthode et le même périmètre ; toute correction est validée sur une métrique utilisateur pertinente.",
      "example": "",
      "limits": "Une durée de collecte ne prouve pas un problème de performance du site."
    },
    "en": {
      "detection": "This duration describes collector work; HTTP time includes network navigation and redirects. It is not perceived rendering time.",
      "steps": [
        "Record network conditions and collector scope before comparing.",
        "To investigate visitor experience, examine rendering measurements and a browser trace rather than changing the site based on this duration alone."
      ],
      "expected": "Comparisons use the same method and scope; any fix is checked against a relevant user metric.",
      "example": "",
      "limits": "A collection duration does not prove a site performance problem."
    }
  },
  {
    "keys": [
      "html.doctype.html5",
      "lighthouse.audit.doctype"
    ],
    "reference": "https://www.w3.org/WAI/tutorials/page-structure/",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML vérifie un doctype html sans identifiants public ou system ; Lighthouse peut examiner le mode du document rendu.",
      "steps": [
        "Vérifier la première déclaration du document réellement servi.",
        "Utiliser le doctype HTML adapté au document puis contrôler le mode de rendu et les pages partageant ce gabarit."
      ],
      "expected": "Le navigateur utilise le mode standards et la mise en page conserve son comportement.",
      "example": "<!doctype html>",
      "limits": "Le contrôle ne valide pas l’ensemble du HTML ni toute la compatibilité des styles."
    },
    "en": {
      "detection": "Argos HTML checks for an html doctype without public or system identifiers; Lighthouse may examine rendered document mode.",
      "steps": [
        "Check the first declaration in the document actually served.",
        "Use the document’s appropriate HTML doctype, then inspect rendering mode and pages sharing the template."
      ],
      "expected": "The browser uses standards mode and layout retains its intended behaviour.",
      "example": "<!doctype html>",
      "limits": "This check does not validate all HTML or all style compatibility."
    }
  },
  {
    "keys": [
      "html.meta.charset.present",
      "lighthouse.audit.charset"
    ],
    "reference": "https://www.w3.org/WAI/tutorials/page-structure/",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos HTML recherche une déclaration charset non vide ou une meta Content-Type avec charset ; il ne détecte pas tous les conflits d’encodage.",
      "steps": [
        "Comparer encodage du fichier, en-tête HTTP et déclaration du document.",
        "Rendre ces déclarations cohérentes puis vérifier accents et caractères non latins après rechargement."
      ],
      "expected": "Les caractères attendus sont rendus sans corruption.",
      "example": "<meta charset=\"utf-8\">",
      "limits": "Un charset déclaré ne garantit pas que les octets utilisent réellement cet encodage."
    },
    "en": {
      "detection": "Argos HTML looks for a non-empty charset declaration or meta Content-Type with charset; it does not detect every encoding conflict.",
      "steps": [
        "Compare file encoding, HTTP header and document declaration.",
        "Make these declarations consistent, then inspect accents and non-Latin characters after reloading."
      ],
      "expected": "Expected characters render without corruption.",
      "example": "<meta charset=\"utf-8\">",
      "limits": "A declared charset does not guarantee that bytes actually use that encoding."
    }
  },
  {
    "keys": [
      "html.social.meta"
    ],
    "reference": "https://developers.google.com/search/docs/appearance/snippet",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Argos relève og:title, og:description, og:image et twitter:card non vides. La règle actuelle accepte au moins trois de ces quatre signaux.",
      "steps": [
        "Comparer les propriétés absentes ou vides avec l’aperçu souhaité pour cette page.",
        "Compléter les métadonnées de partage et vérifier une image publiquement accessible avec un aperçu de partage."
      ],
      "expected": "Le partage présente le titre, le résumé et l’image souhaités.",
      "example": "",
      "limits": "Cette présence ne valide pas tous les réseaux sociaux ni leurs caches. Elle ne décrit pas la meta description de recherche."
    },
    "en": {
      "detection": "Argos records non-empty og:title, og:description, og:image and twitter:card. The current rule accepts at least three of these four signals.",
      "steps": [
        "Compare absent or empty properties with this page’s intended preview.",
        "Complete sharing metadata and check a publicly accessible image using a sharing preview."
      ],
      "expected": "Sharing shows the intended title, summary and image.",
      "example": "",
      "limits": "Presence does not validate every social network or its caches. It is distinct from search meta description."
    }
  },
  {
    "keys": [
      "html.scripts.count",
      "html.size.bytes"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script",
    "verifiedAt": "2026-10-16",
    "fr": {
      "detection": "Le module HTML compte les scripts du document reçu et enregistre sa taille. Ces contrôles sont informatifs ; ils ne prouvent pas un problème de chargement.",
      "steps": [
        "Comparer le document reçu avec les ressources effectivement téléchargées et exécutées.",
        "Identifier un contenu redondant démontré avant tout retrait et tester les pages utilisant le même gabarit."
      ],
      "expected": "Une réduction éventuelle conserve le contenu et les fonctions ; elle est vérifiée dans la cascade réelle.",
      "example": "",
      "limits": "Les anciens rapports peuvent exprimer la taille HTML selon une ancienne méthode. Un nombre de scripts ne mesure pas leur coût d’exécution."
    },
    "en": {
      "detection": "The HTML module counts scripts in the received document and records its size. These checks are informational; they do not prove a loading problem.",
      "steps": [
        "Compare the received document with resources actually downloaded and executed.",
        "Identify demonstrated redundant content before removal and test pages using the same template."
      ],
      "expected": "Any reduction retains content and features and is checked in the actual waterfall.",
      "example": "",
      "limits": "Historical reports may express HTML size using an older method. Script count does not measure execution cost."
    }
  },
  {
    "keys": [
      "lighthouse.audit.font-display-insight"
    ],
    "reference": "https://developer.chrome.com/docs/performance/insights/font-display",
    "verifiedAt": "2026-10-18",
    "fr": {
      "detection": "Lighthouse examine le comportement des polices pendant le chargement. Ce signal invite à vérifier si le texte attend une police distante ; une référence de ressource masquée ne permet pas de retrouver son fichier exact.",
      "summary": "Retrouver la déclaration de la police, choisir son comportement pendant le téléchargement, puis tester la lisibilité et les déplacements du texte.",
      "steps": [
        "Dans les outils du navigateur, filtrer Réseau sur les polices et retrouver la règle @font-face dans les styles chargés. Si le rapport ne conserve que l’origine ou une référence masquée, refaire cette recherche sur la même page.",
        "Tester font-display: swap pour afficher une police de secours pendant le téléchargement, ou optional si conserver cette police de secours est acceptable. Adapter la déclaration à chaque police concernée.",
        "Choisir une police de secours visuellement proche. Recharger sans cache avec une connexion ralentie et examiner les titres, boutons et retours à la ligne."
      ],
      "expected": "Le texte reste lisible pendant le chargement ; le remplacement éventuel de la police ne masque pas un bouton et ne déplace pas excessivement le contenu. Comparer plusieurs chargements au même profil et relancer le contrôle.",
      "example": "@font-face {\n  font-family: \"PoliceExemple\";\n  src: url(\"/police-exemple.woff2\") format(\"woff2\");\n  font-display: swap;\n}\nbody { font-family: \"PoliceExemple\", sans-serif; }",
      "limits": "Cet exemple ne désigne aucune police du site. Le score Lighthouse n’est ni une durée de texte invisible ni un gain garanti. Les polices de secours peuvent modifier la mise en page ; vérifier aussi les caractères et langues utilisés."
    },
    "en": {
      "detection": "Lighthouse examines font behaviour during loading. This signal calls for checking whether text waits for a remote font; a redacted resource reference cannot identify its exact file.",
      "summary": "Locate the font declaration, choose its behaviour during download, then test readability and text movement.",
      "steps": [
        "In browser tools, filter Network by fonts and locate the @font-face rule in loaded styles. If the report retains only an origin or redacted reference, repeat this investigation on the same page.",
        "Test font-display: swap to show a fallback while downloading, or optional if retaining that fallback is acceptable. Adapt the declaration for each affected font.",
        "Choose a visually similar fallback. Reload without cache on a throttled connection and inspect headings, buttons and line breaks."
      ],
      "expected": "Text stays readable during loading; any font replacement does not hide a button or excessively move content. Compare several loads using the same profile and rerun the check.",
      "example": "@font-face {\n  font-family: \"ExampleFont\";\n  src: url(\"/example-font.woff2\") format(\"woff2\");\n  font-display: swap;\n}\nbody { font-family: \"ExampleFont\", sans-serif; }",
      "limits": "This example identifies no font on the site. The Lighthouse score is neither a duration of invisible text nor a guaranteed saving. Fallback fonts can change layout; also check the characters and languages used."
    }
  },
  {
    "keys": [
      "lighthouse.audit.image-delivery-insight"
    ],
    "reference": "https://developer.chrome.com/docs/performance/insights/image-delivery",
    "verifiedAt": "2026-10-18",
    "fr": {
      "detection": "Lighthouse recherche des images dont le transfert pourrait être réduit selon leurs dimensions et leur encodage. Ses économies sont des estimations ; le score seul ne précise ni l’image ni les octets récupérables.",
      "summary": "Retrouver l’image signalée, adapter dimensions et compression à son affichage, puis comparer le fichier réellement téléchargé et sa qualité.",
      "steps": [
        "Dans Réseau, filtrer sur les images et retrouver la ressource signalée. Si son adresse exacte manque, refaire un diagnostic local sur la même URL ; ne pas déduire un fichier de la seule origine affichée.",
        "Comparer dimensions du fichier, taille affichée et densité de pixels de l’écran. Produire plusieurs tailles si nécessaire et adapter srcset et sizes au gabarit réel.",
        "Tester compression et formats adaptés à l’image, puis vérifier visuellement les détails, la transparence et les animations. Remplacer la ressource au point qui la produit et conserver un retour arrière."
      ],
      "expected": "Sur mobile puis sur écran large, contrôler dans Réseau le fichier sélectionné et sa taille transférée. Le transfert ciblé diminue sans perte visuelle inacceptable ni déformation ; relancer au même profil pour comparer.",
      "example": "",
      "limits": "Une économie estimée n’est pas une durée de chargement gagnée. Le rapport peut omettre l’élément ou le motif détaillé. Ce contrôle n’établit pas que l’image est le LCP et ne justifie pas de charger paresseusement toutes les images."
    },
    "en": {
      "detection": "Lighthouse looks for images whose transfer could be reduced based on dimensions and encoding. Savings are estimates; the score alone identifies neither the image nor recoverable bytes.",
      "summary": "Locate the flagged image, adapt dimensions and compression to its display, then compare the actual downloaded file and its quality.",
      "steps": [
        "In Network, filter by images and locate the flagged resource. If its exact address is missing, repeat a local diagnosis on the same URL; do not infer a file from the displayed origin alone.",
        "Compare file dimensions, displayed size and screen pixel density. Produce several sizes if needed and adapt srcset and sizes to the actual template.",
        "Test compression and formats suitable for the image, then visually check details, transparency and animation. Replace the resource where it is produced and retain a rollback option."
      ],
      "expected": "On mobile and then a wide screen, check the selected file and transferred size in Network. Targeted transfer decreases without unacceptable visual loss or distortion; rerun with the same profile to compare.",
      "example": "",
      "limits": "Estimated byte savings are not time saved loading. The report may omit the element or detailed reason. This check does not establish that the image is the LCP and does not justify lazy-loading every image."
    }
  },
  {
    "keys": [
      "lighthouse.audit.cache-insight"
    ],
    "reference": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching",
    "verifiedAt": "2026-10-18",
    "fr": {
      "detection": "Lighthouse examine la durée de réutilisation des ressources et estime le transfert évitable lors de visites suivantes. Ce signal ne signifie pas que la première visite serait accélérée du même montant.",
      "summary": "Choisir une durée de cache selon la ressource et sa mise à jour, puis vérifier une seconde visite et la réception des nouvelles versions.",
      "steps": [
        "Dans Réseau, retrouver la ressource signalée et lire Cache-Control dans sa réponse. Distinguer fichier statique public, contenu personnalisé et ressource tierce avant toute modification.",
        "Pour un fichier public dont l’adresse change à chaque version, définir une durée de cache adaptée au point qui sert ce fichier. Pour une adresse stable, prévoir revalidation ou expiration compatible avec les mises à jour.",
        "Ne pas appliquer un cache public aux réponses privées. Pour une ressource tierce non maîtrisée, évaluer son utilité ou contacter son fournisseur plutôt que prétendre changer ses en-têtes."
      ],
      "expected": "Avec le cache du navigateur activé, visiter deux fois la page et vérifier la réutilisation ou la revalidation prévue. Publier ensuite une version de test du fichier : elle doit être reçue sans effacer manuellement le cache. Vérifier aussi que les réponses privées restent protégées.",
      "example": "",
      "limits": "La durée correcte dépend de la fréquence de modification et de la stratégie de versionnement. Un cache long mal appliqué peut conserver du contenu périmé. Le score ne donne pas une durée de cache à copier ; les détails manquants doivent être relevés dans la réponse."
    },
    "en": {
      "detection": "Lighthouse examines resource reuse lifetime and estimates avoidable transfer on subsequent visits. This signal does not mean the first visit would improve by the same amount.",
      "summary": "Choose cache lifetime according to the resource and its updates, then verify a second visit and receipt of new versions.",
      "steps": [
        "In Network, locate the flagged resource and read Cache-Control in its response. Distinguish public static files, personalised content and third-party resources before making changes.",
        "For a public file whose address changes with every version, set a suitable cache lifetime where it is served. For a stable address, plan revalidation or expiry compatible with updates.",
        "Do not apply public caching to private responses. For a third-party resource outside your control, assess its usefulness or contact its provider instead of claiming to change its headers."
      ],
      "expected": "With browser caching enabled, visit the page twice and check the intended reuse or revalidation. Then publish a test version of the file: it must arrive without manually clearing the cache. Also verify that private responses remain protected.",
      "example": "",
      "limits": "The appropriate lifetime depends on update frequency and versioning strategy. Incorrectly applied long caching can retain stale content. The score does not provide a cache duration to copy; missing details must be inspected in the response."
    }
  },
  {
    "keys": [
      "lighthouse.audit.render-blocking-insight",
      "lighthouse.audit.render-blocking-resources"
    ],
    "reference": "https://developer.chrome.com/docs/performance/insights/render-blocking",
    "verifiedAt": "2026-10-18",
    "fr": {
      "detection": "Lighthouse repère des requêtes qui retardent le premier affichage. Une ressource bloquante peut être nécessaire : ce constat est distinct du code inutilisé.",
      "summary": "Identifier ce qui bloque le premier affichage, différer uniquement ce qui peut l’être et vérifier le rendu ainsi que les interactions.",
      "steps": [
        "Enregistrer un chargement dans Performance et retrouver les ressources signalées dans Réseau. Si le rapport ne fournit pas leur emplacement, refaire cette mesure sur la même URL.",
        "Séparer les styles nécessaires au premier écran de ceux des états ultérieurs. Réduire les styles superflus seulement après avoir testé les pages et états qui les utilisent.",
        "Pour un script classique externe qui peut attendre la fin du parsing HTML, tester defer en préservant l’ordre des dépendances. Ne pas remplacer indistinctement par async ; vérifier aussi les scripts inline qui en dépendent."
      ],
      "expected": "Comparer le premier affichage et la cascade au même profil. Tester menus, formulaires et changements de thème : aucun contenu sans style ni erreur de script ne doit apparaître. Une ressource nécessaire peut rester bloquante ; documenter ce compromis puis relancer.",
      "example": "<!-- Script classique externe pouvant attendre la fin du parsing -->\n<script defer src=\"/exemple-interactions.js\"></script>",
      "limits": "Un score ne donne pas le temps économisé. Différer un style essentiel peut dégrader l’affichage ; intégrer du CSS dans le document demande une gestion de la sécurité et du cache. L’exemple ne s’applique ni aux stylesheets ni à tous les scripts."
    },
    "en": {
      "detection": "Lighthouse identifies requests that delay initial rendering. A blocking resource may be necessary: this finding differs from unused code.",
      "summary": "Identify what blocks initial rendering, defer only what can wait, then check appearance and interactions.",
      "steps": [
        "Record a load in Performance and locate flagged resources in Network. If the report supplies no location, repeat this measurement on the same URL.",
        "Separate styles needed for the first screen from styles for later states. Reduce redundant styles only after testing pages and states that use them.",
        "For an external classic script that can wait until HTML parsing ends, test defer while preserving dependency order. Do not indiscriminately replace it with async; also check inline scripts depending on it."
      ],
      "expected": "Compare initial rendering and the waterfall with the same profile. Test menus, forms and theme changes: no unstyled content or script error should appear. A necessary resource may remain blocking; document this trade-off and rerun.",
      "example": "<!-- External classic script that can wait until parsing ends -->\n<script defer src=\"/example-interactions.js\"></script>",
      "limits": "A score does not specify time saved. Deferring essential styles can degrade rendering; inlining CSS requires security and cache management. The example applies neither to stylesheets nor to every script."
    }
  }
];

export const rulePlaybooks = Object.fromEntries([...playbookGroups, ...detailedRuleGuidance].flatMap(({keys, ...entry}) => keys.map(key => [key, entry])));

export function findingPlaybook(key: string | null | undefined, lang: Lang): Playbook {
  const entry = key && Object.hasOwn(rulePlaybooks, key) ? rulePlaybooks[key] : undefined;
  if (entry) return { ...entry[lang], reference: entry.reference, verifiedAt: entry.verifiedAt, specific: true };
  const lighthouse = key?.startsWith('lighthouse.audit.');
  const zap = key?.startsWith('zap.alert.');
  const fr = lang === 'fr';
  return {
    specific: false,
    reference: lighthouse ? 'https://developer.chrome.com/docs/lighthouse/overview' : zap ? 'https://www.zaproxy.org/docs/alerts/' : undefined,
    detection: lighthouse
      ? (fr ? 'Le collecteur actuel remonte un audit Lighthouse noté sous 0,9, parmi au plus 12 diagnostics priorisés. Sa valeur normalisée n’est pas une durée.' : 'The current collector surfaces a Lighthouse audit scored below 0.9, among at most 12 prioritised diagnostics. Its normalised value is not a duration.')
      : zap ? (fr ? 'Ce signal provient d’une règle ZAP identifiée par sa clé. Son alerte demande confirmation sur la réponse concernée.' : 'This signal comes from the ZAP rule identified by its key. Its alert needs confirmation on the affected response.')
      : (fr ? 'La clé et la source conservées identifient le contrôle. Le seuil et la méthode propres à cette version ne sont pas documentés dans cette fiche.' : 'The retained key and source identify the check. This entry does not document the threshold and method for this version.'),
    steps: fr ? ['Retrouver le diagnostic source par sa clé et comparer le périmètre avec la page auditée.', 'Reproduire le signal sur l’élément ou la réponse concernés avant de modifier la configuration ; demander le détail à l’opérateur si la preuve manque.'] : ['Locate the source diagnosis by its key and compare its scope with the audited page.', 'Reproduce the signal on the affected element or response before changing configuration; request details from the operator if evidence is missing.'],
    expected: fr ? 'Définir le résultat attendu à partir de la règle source, vérifier le parcours manuellement, puis relancer le même contrôle.' : 'Define the expected result from the source rule, check the journey manually, then repeat the same check.',
    example: '',
    limits: fr ? 'Détail indisponible pour cette analyse : règle détaillée, seuil versionné ou élément concerné non documenté dans cette fiche. Aucune cause ou correction propre au site ne peut être déduite de ce seul signal.' : 'Detail unavailable for this analysis: detailed rule, versioned threshold or affected element is not documented in this entry. This signal alone cannot establish a site-specific cause or fix.',
  };
}
