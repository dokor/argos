import type { Lang } from "./i18n/routes";
export type GuideSection = { id: string; title: string; paragraphs: string[]; steps?: string[]; code?: string };
export type GuideCopy = { title: string; description: string; lead: string; sections: GuideSection[] };
export type TechnicalGuide = { route: string; englishRoute: string; sources: { href: string; label: string }[] } & Record<Lang, GuideCopy>;
export const technicalGuides: Record<"lcp" | "csp" | "hsts", TechnicalGuide> = {
  "lcp": {
    "route": "/guides/lcp-lent",
    "englishRoute": "/en/guides/slow-lcp",
    "sources": [
      {
        "href": "https://web.dev/articles/lcp",
        "label": "web.dev · Largest Contentful Paint"
      },
      {
        "href": "https://web.dev/articles/optimize-lcp",
        "label": "web.dev · Optimize LCP"
      },
      {
        "href": "https://developer.chrome.com/docs/performance/insights/lcp-breakdown",
        "label": "Chrome · LCP breakdown"
      },
      {
        "href": "https://developer.chrome.com/docs/devtools/performance",
        "label": "Chrome DevTools · Performance"
      }
    ],
    "fr": {
      "title": "LCP lent : diagnostiquer et améliorer l’affichage principal",
      "description": "Identifiez l’élément LCP, séparez serveur, chargement et rendu, puis vérifiez chaque correction avec des mesures comparables.",
      "lead": "Un LCP lent signifie que le plus grand contenu visible arrive tard. Trouvez ce qui retarde cet élément avant de modifier votre page.",
      "sections": [
        {
          "id": "mesure",
          "title": "Comprendre la mesure",
          "paragraphs": [
            "Le Largest Contentful Paint repère l’affichage du plus grand élément éligible dans la zone visible : image, bloc de texte ou vidéo. La cible est au plus 2,5 s au 75e percentile des visites, séparément sur mobile et ordinateur ; au-delà de 4 s, le résultat est mauvais. Entre les deux, il est à améliorer.",
            "Une exécution Lighthouse ou Argos est une mesure de laboratoire. Comparez-la aux données terrain CrUX ou RUM, lorsqu’elles existent. Vérifiez si les données concernent cette URL ou toute l’origine ; une absence de données ne prouve pas que la page est rapide."
          ]
        },
        {
          "id": "diagnostic",
          "title": "Trouver la partie qui attend",
          "paragraphs": [
            "Enregistrez un chargement dans Performance de Chrome DevTools. Sélectionnez le repère LCP, notez l’élément et, pour une image, retrouvez sa requête dans Réseau. L’élément peut changer selon la largeur et le contenu."
          ],
          "steps": [
            "HTML tardif (TTFB élevé) : examiner redirections, traitement serveur et cache. Tester un cache partagé seulement si la réponse ne contient aucune donnée privée.",
            "HTML reçu mais requête LCP tardive : chercher une image injectée par JavaScript, un fond découvert via CSS ou un chargement différé.",
            "Requête commencée mais longue : comparer poids transféré, dimensions, format et cache de la ressource.",
            "Ressource prête mais élément invisible : examiner CSS bloquante, police, masquage initial et longues tâches JavaScript. Pour un LCP texte, commencer par ces pistes."
          ]
        },
        {
          "id": "correction",
          "title": "Corriger une cause à la fois",
          "paragraphs": [
            "Pour une image principale identifiée comme LCP, rendez son URL découvrable dans le HTML initial. Retirez loading=\"lazy\" et testez fetchpriority=\"high\". Réservez cette priorité à la ressource critique ; précharger toutes les images crée de la concurrence.",
            "Servez des dimensions adaptées via srcset/sizes et comparez WebP/AVIF à qualité acceptable. Réduisez les scripts inutiles et le CSS critique bloquant. Un fichier plus léger ne corrige pas un élément qui reste caché jusqu’à la fin d’un script."
          ],
          "code": "<img src=\"/hero.webp\" width=\"960\" height=\"540\"\n     fetchpriority=\"high\" alt=\"Présentation du produit\">"
        },
        {
          "id": "verification",
          "title": "Mesurer avant et après",
          "paragraphs": [
            "Gardez la même URL de test, largeur, version du navigateur, ralentissement CPU/réseau et état du cache. Faites au moins cinq passages avant et après ; conservez les valeurs et leur médiane, puis vérifiez l’élément LCP et ses délais dans la trace.",
            "L’exemple local ci-dessous utilise uniquement une page de démonstration. Il illustre le retrait d’un délai de découverte ; ses résultats ne prédisent pas le gain de votre site. Vérifiez ensuite que les interactions, la qualité d’image et les données terrain ne régressent pas."
          ]
        },
        {
          "id": "argos",
          "title": "Lire le constat dans Argos",
          "paragraphs": [
            "Le rapport expose les mesures de navigateur disponibles et les constats Lighthouse associés, dont runtime.lcp et lighthouse.audit.largest-contentful-paint. Les valeurs proviennent d’exécutions différentes et peuvent varier. Un module indisponible ne vaut pas un LCP de zéro.",
            "Argos n’identifie pas à lui seul la cause de chaque retard et ne collecte pas votre percentile terrain. Après correction, relancez l’audit de la même page et confrontez-le à vos traces."
          ]
        }
      ]
    },
    "en": {
      "title": "Slow LCP: diagnose and improve main content rendering",
      "description": "Identify the LCP element, separate server, loading and rendering delays, and verify each fix with comparable measurements.",
      "lead": "A slow LCP means the largest visible content arrives late. Find what holds that element back before changing your page.",
      "sections": [
        {
          "id": "mesure",
          "title": "Understand the measurement",
          "paragraphs": [
            "Largest Contentful Paint marks the rendering of the largest eligible element in the viewport: an image, text block or video. Aim for 2.5 s or less at the 75th percentile of visits, separately for mobile and desktop; over 4 s is poor. Results between those thresholds need improvement.",
            "A Lighthouse or Argos run is a laboratory measurement. Compare it with CrUX or RUM field data when available. Check whether the data describes this URL or the entire origin; missing data does not prove that the page is fast."
          ]
        },
        {
          "id": "diagnostic",
          "title": "Find the part that is waiting",
          "paragraphs": [
            "Record a page load in Chrome DevTools Performance. Select the LCP marker, record the element and, for an image, find its request in Network. The element can change with viewport size and content."
          ],
          "steps": [
            "Late HTML (high TTFB): inspect redirects, server processing and caching. Only test a shared cache when the response contains no private data.",
            "HTML received but late LCP request: look for a JavaScript-inserted image, a background discovered through CSS or deferred loading.",
            "Request started but slow: compare transferred size, dimensions, format and resource caching.",
            "Resource ready but element invisible: inspect blocking CSS, fonts, initial hiding and long JavaScript tasks. Start here for a text LCP."
          ]
        },
        {
          "id": "correction",
          "title": "Fix one cause at a time",
          "paragraphs": [
            "For a main image identified as LCP, make its URL discoverable in the initial HTML. Remove loading=\"lazy\" and test fetchpriority=\"high\". Reserve this priority for the critical resource; preloading every image adds contention.",
            "Serve appropriate dimensions using srcset/sizes and compare WebP/AVIF at acceptable quality. Reduce unnecessary scripts and blocking critical CSS. A smaller file cannot fix an element that stays hidden until a script finishes."
          ],
          "code": "<img src=\"/hero.webp\" width=\"960\" height=\"540\"\n     fetchpriority=\"high\" alt=\"Product presentation\">"
        },
        {
          "id": "verification",
          "title": "Measure before and after",
          "paragraphs": [
            "Keep the same test URL, viewport, browser version, CPU/network throttling and cache state. Run at least five passes before and after; retain individual values and the median, then check the LCP element and delays in the trace.",
            "The local example below uses only a demonstration page. It illustrates removing a discovery delay; its results do not predict your site’s improvement. Check afterwards for regressions in interactions, image quality and field data."
          ]
        },
        {
          "id": "argos",
          "title": "Read the Argos finding",
          "paragraphs": [
            "The report exposes available browser measurements and associated Lighthouse findings, including runtime.lcp and lighthouse.audit.largest-contentful-paint. Values come from different runs and may vary. An unavailable module does not mean a zero LCP.",
            "Argos cannot determine every delay’s cause on its own and does not collect your field percentile. After a fix, rerun the same page and compare it with your traces."
          ]
        }
      ]
    }
  },
  "csp": {
    "route": "/guides/content-security-policy",
    "englishRoute": "/en/guides/content-security-policy",
    "sources": [
      {
        "href": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP",
        "label": "MDN · Content Security Policy"
      },
      {
        "href": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only",
        "label": "MDN · Report-Only"
      },
      {
        "href": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src",
        "label": "MDN · script-src"
      },
      {
        "href": "https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html",
        "label": "OWASP · CSP Cheat Sheet"
      },
      {
        "href": "https://www.w3.org/TR/CSP3/",
        "label": "W3C · CSP Level 3"
      }
    ],
    "fr": {
      "title": "Content Security Policy : préparer une CSP adaptée",
      "description": "Comprenez une CSP absente, testez en Report-Only, puis appliquez une politique adaptée sans bloquer les parcours utiles.",
      "lead": "Une CSP limite les sources et les comportements autorisés par le navigateur. Son déploiement commence par l’inventaire de votre page, pas par une configuration universelle.",
      "sections": [
        {
          "id": "role",
          "title": "Ce que CSP protège",
          "paragraphs": [
            "Content Security Policy réduit notamment certains risques d’exécution de code injecté. Elle complète l’échappement des sorties, la validation des entrées et les corrections de vulnérabilités ; elle ne garantit ni l’absence de XSS ni une conformité.",
            "L’en-tête HTTP s’applique dès la réponse du document. Une balise meta a des limites : pas de mode Report-Only, pas de directive frame-ancestors, et aucune protection rétroactive du contenu déjà traité. Préférez l’en-tête."
          ]
        },
        {
          "id": "inventaire",
          "title": "Inventorier avant de bloquer",
          "paragraphs": [
            "Sur un environnement de test, parcourez connexion, formulaires, paiement, intégrations, polices, images et scripts. Relevez les origines réellement nécessaires et les scripts/styles inline. Incluez les variantes de consentement et d’utilisateur connecté."
          ],
          "steps": [
            "Construire une liste minimale par type de ressource. Éviter les jokers et autorisations https: globales par facilité.",
            "Identifier qui pose les en-têtes : application, serveur ou CDN. Plusieurs politiques imposées se cumulent ; une seconde ne desserre pas la première.",
            "Choisir des nonces imprévisibles renouvelés par réponse, ou des hash pour les scripts statiques maîtrisés, lorsque le contenu inline est nécessaire."
          ]
        },
        {
          "id": "report-only",
          "title": "Observer avec Report-Only",
          "paragraphs": [
            "Pour une page statique de test dont les ressources sont de même origine, cet exemple observe les violations sans appliquer les blocages. Adaptez chaque directive à votre inventaire. Les violations sont visibles dans la console ; aucun collecteur de rapports n’est configuré ici."
          ],
          "code": "Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          "steps": [
            "Recharger et effectuer chaque parcours ; lire la directive et la ressource concernées dans les violations.",
            "Distinguer ressource attendue, injection et bruit d’extension. Ne pas autoriser une origine simplement pour faire disparaître un message.",
            "Si vous ajoutez un collecteur, maîtriser accès, volume et conservation : les rapports peuvent contenir des URL sensibles."
          ]
        },
        {
          "id": "appliquer",
          "title": "Appliquer, puis tester les régressions",
          "paragraphs": [
            "Quand les parcours fonctionnent, servez la politique adaptée sous Content-Security-Policy. Surveillez les erreurs et gardez une procédure de retour à la politique précédente. Une CSP déjà imposée reste active même si vous ajoutez Report-Only.",
            "Évitez unsafe-inline dans script-src : il autorise les scripts inline dans les politiques où il est effectif. Un nonce exige une génération aléatoire serveur et un attribut correspondant sur chaque script autorisé ; ne copiez jamais un nonce fixe depuis un exemple. Testez aussi les mises en cache HTML."
          ]
        },
        {
          "id": "argos",
          "title": "Ce que le contrôle Argos établit",
          "paragraphs": [
          "Le contrôle http.security.csp lit l’en-tête Content-Security-Policy final et reconnaît un sous-ensemble restrictif de script-src, ou de default-src en son absence : self, none, nonces, hash et origines HTTPS explicites. Une politique non reconnue reste à vérifier ; cette heuristique ne prouve pas l’absence de XSS. Report-Only ne satisfait pas ce contrôle.",
            "Les modules externes peuvent ajouter d’autres constats si disponibles. Relancez l’audit après vos tests fonctionnels ; examinez les preuves et la couverture du rapport. HSTS traite le transport HTTPS, avec un déploiement différent."
          ]
        }
      ]
    },
    "en": {
      "title": "Content Security Policy: prepare a suitable CSP",
      "description": "Understand a missing CSP, test with Report-Only, then enforce a tailored policy without breaking useful journeys.",
      "lead": "A CSP limits the sources and behaviours the browser permits. Deployment starts with an inventory of your page, not a universal configuration.",
      "sections": [
        {
          "id": "role",
          "title": "What CSP protects",
          "paragraphs": [
            "Content Security Policy reduces some risks of injected code execution. It complements output escaping, input validation and vulnerability fixes; it does not guarantee freedom from XSS or certify compliance.",
            "An HTTP header applies from the document response. A meta tag has limitations: no Report-Only mode, no frame-ancestors directive, and no retroactive protection for content already processed. Prefer the header."
          ]
        },
        {
          "id": "inventaire",
          "title": "Inventory before blocking",
          "paragraphs": [
            "In a test environment, exercise sign-in, forms, payment, integrations, fonts, images and scripts. Record the origins actually needed and inline scripts/styles. Include consent and signed-in variants."
          ],
          "steps": [
            "Build a minimal list for each resource type. Avoid broad wildcards and global https: allowances for convenience.",
            "Identify what sets headers: application, server or CDN. Multiple enforced policies apply together; adding another cannot relax the first.",
            "Choose unpredictable nonces renewed per response, or hashes for controlled static scripts, when inline content is required."
          ]
        },
        {
          "id": "report-only",
          "title": "Observe with Report-Only",
          "paragraphs": [
            "For a static test page with same-origin resources, this example observes violations without enforcing blocks. Adapt every directive to your inventory. Violations appear in the console; no reporting collector is configured here."
          ],
          "code": "Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          "steps": [
            "Reload and exercise every journey; read the affected directive and resource in violations.",
            "Distinguish expected resources, injection and extension noise. Do not allow an origin simply to dismiss a message.",
            "If you add a collector, control access, volume and retention: reports may contain sensitive URLs."
          ]
        },
        {
          "id": "appliquer",
          "title": "Enforce, then check for regressions",
          "paragraphs": [
            "Once journeys work, serve the tailored policy under Content-Security-Policy. Monitor errors and keep a procedure to restore the previous policy. An already enforced CSP stays active when you add Report-Only.",
            "Avoid unsafe-inline in script-src: it permits inline scripts in policies where it is effective. A nonce requires random server generation and a matching attribute on each allowed script; never copy a fixed example nonce. Check HTML caching too."
          ]
        },
        {
          "id": "argos",
          "title": "What the Argos check establishes",
          "paragraphs": [
          "The http.security.csp check reads the final Content-Security-Policy header and recognises a restrictive subset of script-src, or default-src when absent: self, none, nonces, hashes and explicit HTTPS origins. An unrecognised policy needs review; this heuristic cannot prove freedom from XSS. Report-Only does not satisfy this check.",
            "External modules may add findings when available. Rerun the audit after functional tests; inspect evidence and report coverage. HSTS addresses HTTPS transport and has a different deployment process."
          ]
        }
      ]
    }
  },
  "hsts": {
    "route": "/guides/hsts",
    "englishRoute": "/en/guides/hsts",
    "sources": [
      {
        "href": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security",
        "label": "MDN · Strict-Transport-Security"
      },
      {
        "href": "https://www.rfc-editor.org/rfc/rfc6797",
        "label": "IETF · RFC 6797"
      },
      {
        "href": "https://hstspreload.org/",
        "label": "HSTS Preload · Requirements and removal"
      }
    ],
    "fr": {
      "title": "Configurer HSTS sans bloquer vos visiteurs",
      "description": "Vérifiez HTTPS, progressez avec max-age et comprenez includeSubDomains et preload avant d’étendre HSTS.",
      "lead": "HSTS demande au navigateur de revenir en HTTPS. Une erreur peut rester mémorisée : commencez par vérifier les hôtes concernés et choisissez une durée courte.",
      "sections": [
        {
          "id": "role",
          "title": "Protéger les prochaines connexions",
          "paragraphs": [
            "Strict-Transport-Security est un en-tête reçu via HTTPS valide. Le navigateur mémorise la règle pendant max-age secondes et convertit ensuite les accès HTTP vers HTTPS. Il n’autorise plus le contournement d’une erreur de certificat pour cet hôte.",
            "Sans règle mémorisée ni préchargement, la toute première visite HTTP reste exposée. Une redirection HTTP vers HTTPS reste nécessaire. HSTS ne corrige ni un certificat invalide, ni une faille applicative, ni la sécurité du contenu."
          ]
        },
        {
          "id": "prerequis",
          "title": "Vérifier le périmètre HTTPS",
          "paragraphs": [
            "Utilisez des hôtes que vous administrez. Vérifiez certificat, renouvellement, redirections et ressources HTTPS pour les pages principales, les erreurs et les services annexes. Inventoriez les sous-domaines, y compris les anciens services et ceux gérés par un tiers.",
            "Ces commandes utilisent GET sans télécharger le corps et sans désactiver la validation TLS. Lisez chaque réponse de redirection et la réponse finale ; ne concluez pas à partir de HEAD seulement."
          ],
          "code": "curl -sS -D - -o /dev/null http://example.com/\ncurl -sS -L -D - -o /dev/null https://example.com/\ncurl -sS -D - -o /dev/null https://app.example.com/"
        },
        {
          "id": "progression",
          "title": "Augmenter max-age par étapes",
          "paragraphs": [
            "Exemple initial pour un hôte déjà opérationnel en HTTPS : une règle de 300 secondes, sans sous-domaines ni preload. Placez-la sur les réponses HTTPS du serveur ou du proxy responsable, puis vérifiez l’en-tête réellement reçu."
          ],
          "code": "Strict-Transport-Security: max-age=300",
          "steps": [
            "Tester navigation, certificats et renouvellement pendant cette phase courte.",
            "Si le service reste fiable, passer par exemple à 86400 secondes (un jour), puis augmenter selon votre capacité à maintenir HTTPS.",
            "Surveiller les erreurs avant chaque hausse. Une durée longue engage aussi les visiteurs qui ne reviennent pas pendant votre correction."
          ]
        },
        {
          "id": "sous-domaines",
          "title": "includeSubDomains et preload : deux engagements",
          "paragraphs": [
            "includeSubDomains couvre tous les descendants de l’hôte qui porte la règle, y compris ceux ajoutés plus tard. Ne l’ajoutez qu’après validation HTTPS de ce périmètre. Une règle reçue sur www.example.com ne protège pas automatiquement example.com.",
            "preload n’est pas recommandé par défaut. Le jeton seul n’inscrit pas un domaine : une soumission et les critères de la liste sont nécessaires, notamment HTTPS pour tous les sous-domaines et un max-age d’au moins un an avec includeSubDomains. Le retrait et sa propagation dans les navigateurs prennent du temps."
          ]
        },
        {
          "id": "retrait",
          "title": "Préparer un retour arrière",
          "paragraphs": [
            "max-age=0 envoyé en HTTPS valide supprime la règle dynamique de cet hôte quand le navigateur le reçoit. Cela n’efface ni une règle héritée d’un parent, ni les règles propres des sous-domaines, ni une entrée préchargée. Retirer simplement l’en-tête laisse les règles déjà mémorisées expirer naturellement.",
            "Maintenez HTTPS pendant la transition. Les visiteurs bloqués par un certificat invalide ne pourront pas recevoir votre en-tête correctif."
          ]
        },
        {
          "id": "argos",
          "title": "Vérifier le résultat avec Argos",
          "paragraphs": [
          "http.security.hsts vérifie un max-age positif reconnu et le contexte HTTPS de la réponse finale. Des constats TLS externes peuvent le compléter. Cette heuristique ne prouve ni une durée adaptée, ni la couverture des sous-domaines, ni l’inscription effective dans la liste preload.",
            "Après vos contrôles de périmètre, relancez un audit de la page. Comparez l’URL finale et les preuves ; une mesure sur une URL ne valide pas tous vos hôtes. Consultez aussi le guide CSP pour les règles de chargement du contenu."
          ]
        }
      ]
    },
    "en": {
      "title": "Configure HSTS without locking visitors out",
      "description": "Verify HTTPS, increase max-age gradually and understand includeSubDomains and preload before extending HSTS.",
      "lead": "HSTS tells the browser to return over HTTPS. Mistakes can remain stored: verify the affected hosts first and start with a short duration.",
      "sections": [
        {
          "id": "role",
          "title": "Protect later connections",
          "paragraphs": [
            "Strict-Transport-Security is a header received over valid HTTPS. The browser stores the rule for max-age seconds and then upgrades HTTP visits to HTTPS. It no longer allows bypassing certificate errors for that host.",
            "Without a stored rule or preloading, the first HTTP visit remains exposed. An HTTP-to-HTTPS redirect is still needed. HSTS cannot fix an invalid certificate, application vulnerability or content security."
          ]
        },
        {
          "id": "prerequis",
          "title": "Check HTTPS coverage",
          "paragraphs": [
            "Use hosts you administer. Check certificates, renewal, redirects and HTTPS resources on main pages, error pages and auxiliary services. Inventory subdomains, including old services and those managed by third parties.",
            "These commands use GET without downloading the body or disabling TLS verification. Read every redirect response and the final response; do not rely on HEAD alone."
          ],
          "code": "curl -sS -D - -o /dev/null http://example.com/\ncurl -sS -L -D - -o /dev/null https://example.com/\ncurl -sS -D - -o /dev/null https://app.example.com/"
        },
        {
          "id": "progression",
          "title": "Increase max-age in stages",
          "paragraphs": [
            "Initial example for a host already working over HTTPS: a 300-second rule, without subdomains or preload. Set it on HTTPS responses at the responsible server or proxy, then verify the header actually received."
          ],
          "code": "Strict-Transport-Security: max-age=300",
          "steps": [
            "Test navigation, certificates and renewal during the short phase.",
            "If the service remains reliable, move for example to 86400 seconds (one day), then increase according to your ability to maintain HTTPS.",
            "Monitor errors before every increase. A long duration also affects visitors who do not return while you apply a fix."
          ]
        },
        {
          "id": "sous-domaines",
          "title": "includeSubDomains and preload: two commitments",
          "paragraphs": [
            "includeSubDomains covers every descendant of the host setting the rule, including future subdomains. Add it only after validating HTTPS throughout that scope. A rule received on www.example.com does not automatically protect example.com.",
            "preload is not recommended by default. The token alone does not list a domain: submission and list requirements are necessary, including HTTPS on all subdomains and a max-age of at least one year with includeSubDomains. Removal and propagation through browsers take time."
          ]
        },
        {
          "id": "retrait",
          "title": "Prepare a rollback",
          "paragraphs": [
            "max-age=0 sent over valid HTTPS removes that host’s dynamic rule when the browser receives it. It does not remove a parent’s inherited rule, subdomains’ own rules or a preloaded entry. Simply removing the header leaves existing stored rules to expire naturally.",
            "Maintain HTTPS during the transition. Visitors blocked by an invalid certificate cannot receive your corrective header."
          ]
        },
        {
          "id": "argos",
          "title": "Check the result with Argos",
          "paragraphs": [
          "http.security.hsts checks for a recognised positive max-age and an HTTPS final response. External TLS findings may supplement it. This heuristic cannot prove a suitable duration, subdomain coverage or actual inclusion in the preload list.",
            "After checking your scope, rerun a page audit. Compare the final URL and evidence; one URL measurement cannot validate every host. Read the CSP guide for content-loading rules too."
          ]
        }
      ]
    }
  }
};
