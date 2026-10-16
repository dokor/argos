import type { Lang } from '@/lib/i18n/routes';
export type WebTip = { id: string; category: string; active: boolean; sourceUrl: string; verifiedAt: string; validUntil?: string; translations: Partial<Record<Lang, string>> };
export const webTips: WebTip[] = [
  {
    "id": "search-snippet",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/appearance/snippet",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Google peut utiliser la meta description comme extrait ou choisir un passage de la page selon la recherche.",
      "en": "Google may use the meta description as a snippet or choose page content depending on the query."
    }
  },
  {
    "id": "unique-description",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/appearance/snippet",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une description spécifique à chaque page aide à présenter son contenu ; une liste de mots-clés renseigne peu le lecteur.",
      "en": "A page-specific description helps explain its content; a keyword list tells readers little."
    }
  },
  {
    "id": "snippet-length",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/appearance/snippet",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Google peut tronquer un extrait selon la largeur d’affichage : un nombre de caractères ne garantit pas son rendu.",
      "en": "Google may truncate a snippet to fit the display width: a character count does not guarantee its appearance."
    }
  },
  {
    "id": "robots-indexing",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "robots.txt règle l’exploration. Une URL bloquée peut encore apparaître dans les résultats de Google.",
      "en": "robots.txt controls crawling. A blocked URL can still appear in Google results."
    }
  },
  {
    "id": "robots-privacy",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "robots.txt est public : il ne protège pas une page privée. Un contrôle d’accès reste nécessaire.",
      "en": "robots.txt is public: it does not protect a private page. Access control is still needed."
    }
  },
  {
    "id": "canonical-signal",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une URL canonique indique une version préférée parmi des pages proches ; ce signal ne remplace pas une redirection.",
      "en": "A canonical URL indicates a preferred version among similar pages; this signal does not replace a redirect."
    }
  },
  {
    "id": "canonical-consistency",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Liens internes, sitemap et balises canonical cohérents évitent d’envoyer des indications contradictoires aux moteurs.",
      "en": "Consistent internal links, sitemaps and canonical tags avoid sending conflicting signals to search engines."
    }
  },
  {
    "id": "sitemap-discovery",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un sitemap aide les moteurs à découvrir des URL. Sa présence ne garantit ni leur exploration ni leur indexation.",
      "en": "A sitemap helps search engines discover URLs. Its presence guarantees neither crawling nor indexing."
    }
  },
  {
    "id": "sitemap-small-site",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un petit site bien relié peut être découvert sans sitemap ; l’utilité du fichier dépend du site.",
      "en": "A small, well-linked site may be discovered without a sitemap; its usefulness depends on the site."
    }
  },
  {
    "id": "sitemap-images",
    "category": "seo",
    "active": true,
    "sourceUrl": "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un sitemap peut compléter les informations sur des images ou vidéos difficiles à découvrir par les liens seuls.",
      "en": "A sitemap can add information about images or videos that links alone may not readily expose."
    }
  },
  {
    "id": "lab-field",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://web.dev/articles/vitals",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une mesure de laboratoire décrit un scénario contrôlé. Les données de terrain reflètent les visites réellement observées.",
      "en": "A lab measurement describes a controlled scenario. Field data reflects actual observed visits."
    }
  },
  {
    "id": "vitals-dimensions",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://web.dev/articles/vitals",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Les Core Web Vitals examinent trois aspects distincts : chargement, réactivité et stabilité visuelle.",
      "en": "Core Web Vitals examine three separate aspects: loading, responsiveness and visual stability."
    }
  },
  {
    "id": "vitals-context",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://web.dev/articles/vitals",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un résultat de performance dépend des conditions de mesure. Comparer deux valeurs demande un contexte comparable.",
      "en": "A performance result depends on measurement conditions. Comparing values requires a comparable context."
    }
  },
  {
    "id": "responsive-images",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Multimedia",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une image adaptée à la taille affichée peut éviter de télécharger une version inutilement grande.",
      "en": "An image matched to its display size can avoid downloading an unnecessarily large version."
    }
  },
  {
    "id": "image-formats",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Multimedia",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Le bon format d’image dépend du contenu, de la transparence et de la qualité attendue ; comparer le résultat visuel compte aussi.",
      "en": "The right image format depends on content, transparency and required quality; comparing visual results matters too."
    }
  },
  {
    "id": "lazy-below-fold",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Multimedia",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Différer des images hors écran peut économiser des transferts. L’image principale visible demande une autre stratégie.",
      "en": "Deferring off-screen images can save transfers. The visible main image needs a different strategy."
    }
  },
  {
    "id": "lcp-discovery",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://web.dev/articles/optimize-lcp",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Le contenu principal peut attendre sa découverte dans le HTML avant même que son téléchargement commence.",
      "en": "The main content may wait to be discovered in HTML before its download even starts."
    }
  },
  {
    "id": "lcp-parts",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://web.dev/articles/optimize-lcp",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un LCP tardif peut venir de la réponse serveur, du téléchargement ou du rendu : compresser une image ne règle pas tous les cas.",
      "en": "A late LCP can stem from server response, downloading or rendering: compressing an image does not address every case."
    }
  },
  {
    "id": "reserve-images",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://web.dev/articles/optimize-cls",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Déclarer les dimensions des images aide le navigateur à réserver leur espace avant le téléchargement.",
      "en": "Declaring image dimensions helps the browser reserve their space before downloading."
    }
  },
  {
    "id": "reserve-embeds",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://web.dev/articles/optimize-cls",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une publicité ou une intégration ajoutée sans espace réservé peut déplacer le contenu déjà en cours de lecture.",
      "en": "An advert or embed inserted without reserved space can shift content that someone is already reading."
    }
  },
  {
    "id": "font-shift",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://web.dev/articles/optimize-cls",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Le remplacement d’une police peut déplacer les lignes de texte ; les polices de repli méritent aussi un test.",
      "en": "Replacing a font can shift lines of text; fallback fonts deserve testing too."
    }
  },
  {
    "id": "cache-private",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un contenu personnalisé demande une politique de cache adaptée pour éviter sa réutilisation par un cache partagé.",
      "en": "Personalised content needs a suitable cache policy to avoid reuse by a shared cache."
    }
  },
  {
    "id": "cache-no-cache",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "no-cache autorise le stockage mais demande une revalidation ; no-store interdit le stockage par le cache.",
      "en": "no-cache allows storage but requires revalidation; no-store prevents cache storage."
    }
  },
  {
    "id": "cache-versioned",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Changer l’URL d’une ressource quand son contenu change facilite un cache long sans servir l’ancienne version indéfiniment.",
      "en": "Changing a resource URL when its content changes supports long caching without indefinitely serving an old version."
    }
  },
  {
    "id": "script-defer",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "defer permet à un script classique externe d’attendre la fin de l’analyse HTML avant son exécution.",
      "en": "defer lets an external classic script wait until HTML parsing finishes before execution."
    }
  },
  {
    "id": "script-async",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Les scripts async s’exécutent quand ils sont prêts ; leur ordre d’exécution n’est pas garanti.",
      "en": "async scripts execute when ready; their execution order is not guaranteed."
    }
  },
  {
    "id": "script-module",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Les scripts de type module sont différés par défaut ; ajouter defer n’en modifie pas le comportement.",
      "en": "Module scripts are deferred by default; adding defer does not change their behaviour."
    }
  },
  {
    "id": "alt-context",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/images/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "L’alternative d’une image dépend de son rôle dans la page, pas seulement de ce que montre la photo.",
      "en": "An image alternative depends on its role in the page, not only on what the photo shows."
    }
  },
  {
    "id": "alt-decorative",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/images/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une image purement décorative peut utiliser alt vide pour ne pas ajouter de bruit en lecture assistée.",
      "en": "A purely decorative image can use an empty alt to avoid adding noise in assisted reading."
    }
  },
  {
    "id": "alt-functional",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/images/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Pour une image servant de lien ou de bouton, l’alternative doit expliquer la fonction ou la destination.",
      "en": "For an image used as a link or button, the alternative should explain its function or destination."
    }
  },
  {
    "id": "alt-complex",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/images/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un graphique complexe peut nécessiter une explication dans le texte, au-delà d’une courte alternative.",
      "en": "A complex chart may need an explanation in the text beyond a short alternative."
    }
  },
  {
    "id": "form-label",
    "category": "ux",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/forms/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un libellé associé au champ reste utile pendant la saisie ; un placeholder disparaît quand on écrit.",
      "en": "A label associated with a field remains useful during entry; a placeholder disappears when typing."
    }
  },
  {
    "id": "form-error",
    "category": "ux",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/forms/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un message d’erreur utile identifie le champ concerné et explique comment reprendre la saisie.",
      "en": "A useful error message identifies the affected field and explains how to correct the entry."
    }
  },
  {
    "id": "form-groups",
    "category": "ux",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/forms/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Regrouper les champs liés aide à comprendre quelles informations appartiennent à une même question.",
      "en": "Grouping related fields helps explain which information belongs to the same question."
    }
  },
  {
    "id": "form-instructions",
    "category": "ux",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/forms/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Donner le format attendu avant la saisie peut éviter à l’utilisateur de découvrir une contrainte après l’envoi.",
      "en": "Giving the expected format before entry can avoid making users discover a constraint after submission."
    }
  },
  {
    "id": "headings-navigation",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/page-structure/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une hiérarchie de titres logique permet aussi de naviguer dans la page avec un lecteur d’écran.",
      "en": "A logical heading hierarchy also enables navigation through a page with a screen reader."
    }
  },
  {
    "id": "landmarks",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/page-structure/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Les régions navigation et contenu principal aident à s’orienter sans parcourir chaque lien de la page.",
      "en": "Navigation and main-content regions help users orient themselves without traversing every link."
    }
  },
  {
    "id": "skip-link",
    "category": "ux",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/tutorials/page-structure/",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un lien d’évitement permet aux utilisateurs du clavier de passer directement au contenu principal.",
      "en": "A skip link lets keyboard users move directly to the main content."
    }
  },
  {
    "id": "keyboard-journey",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un parcours accessible au clavier doit permettre d’activer les fonctions, pas seulement d’atteindre les éléments.",
      "en": "A keyboard-accessible journey must allow users to activate functions, not merely reach elements."
    }
  },
  {
    "id": "keyboard-pointer",
    "category": "ux",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une fonction disponible à la souris demande aussi un équivalent au clavier lorsqu’elle ne dépend pas du tracé du geste.",
      "en": "A mouse function also needs a keyboard equivalent when it does not depend on the path of a gesture."
    }
  },
  {
    "id": "contrast-background",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Le contraste se mesure entre le texte et son fond réel, y compris lorsqu’une image est placée derrière.",
      "en": "Contrast is measured between text and its actual background, including an image placed behind it."
    }
  },
  {
    "id": "contrast-themes",
    "category": "a11y",
    "active": true,
    "sourceUrl": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Changer de thème change les couples texte et fond : un contraste correct en clair ne valide pas le sombre.",
      "en": "Changing theme changes text and background pairs: good contrast in light mode does not validate dark mode."
    }
  },
  {
    "id": "csp-layer",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une CSP ajoute une protection dans le navigateur ; elle ne remplace pas la correction des injections dans le code.",
      "en": "CSP adds browser protection; it does not replace fixing injection flaws in code."
    }
  },
  {
    "id": "csp-report-only",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Une CSP en mode Report-Only aide à examiner les violations avant d’activer une politique bloquante.",
      "en": "A Report-Only CSP helps inspect violations before enabling an enforcing policy."
    }
  },
  {
    "id": "cookie-httponly",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "HttpOnly empêche la lecture d’un cookie par JavaScript ; cet attribut ne remplace pas Secure.",
      "en": "HttpOnly prevents JavaScript from reading a cookie; this attribute does not replace Secure."
    }
  },
  {
    "id": "cookie-samesite",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "SameSite encadre l’envoi de cookies entre sites. Le choix doit tenir compte des connexions et intégrations utilisées.",
      "en": "SameSite governs cross-site cookie sending. The choice must account for sign-in flows and integrations."
    }
  },
  {
    "id": "hsts-scope",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "includeSubDomains étend HSTS aux sous-domaines : vérifier leur compatibilité HTTPS avant de l’activer.",
      "en": "includeSubDomains extends HSTS to subdomains: check their HTTPS compatibility before enabling it."
    }
  },
  {
    "id": "referrer-policy",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Referrer-Policy permet de limiter les informations de la page d’origine envoyées pendant une navigation.",
      "en": "Referrer-Policy can limit information about the originating page sent during navigation."
    }
  },
  {
    "id": "tls-scope",
    "category": "security",
    "active": true,
    "sourceUrl": "https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "TLS protège les échanges en transit ; il ne prouve pas que le contenu reçu ou le site lui-même est sans risque.",
      "en": "TLS protects data in transit; it does not prove that received content or the site itself is safe."
    }
  },
  {
    "id": "lighthouse-score",
    "category": "performance",
    "active": true,
    "sourceUrl": "https://developer.chrome.com/docs/lighthouse/performance/performance-scoring",
    "verifiedAt": "2026-10-16",
    "translations": {
      "fr": "Un score Lighthouse résume plusieurs métriques et peut varier entre deux exécutions ; examiner les mesures aide à comprendre l’écart.",
      "en": "A Lighthouse score combines several metrics and can vary between runs; inspecting measurements helps explain the difference."
    }
  }
];

export function selectWebTip(entries: readonly WebTip[], lang: Lang, previous?: string | null, random = Math.random, today = new Date().toISOString().slice(0,10)): WebTip | undefined {
  const valid = entries.filter(tip => tip.active && tip.translations[lang]?.trim() && (!tip.validUntil || tip.validUntil >= today) && /^https:\/\//.test(tip.sourceUrl));
  const alternatives = valid.filter(tip => tip.id !== previous);
  const pool = alternatives.length ? alternatives : valid;
  return pool.length ? pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))] : undefined;
}
