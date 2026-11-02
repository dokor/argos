// French guides: English routes are not advertised until complete translations exist.
export const diagnosticGuides = {
  cls: {
    slug: "cls-eleve",
    title: "CLS élevé : trouver ce qui fait bouger votre page",
    description: "Repérez les décalages de mise en page, identifiez leur cause et vérifiez la correction. Une méthode pratique avec une démonstration avant/après.",
    eyebrow: "Performance · Guide de correction",
    readingMinutes: 7,
    sources: [
      { href: "https://web.dev/articles/cls", label: "web.dev : définition et calcul du CLS" },
      { href: "https://web.dev/articles/optimize-cls", label: "web.dev : diagnostiquer et réduire les décalages" },
      { href: "https://web.dev/articles/font-best-practices", label: "web.dev : polices et stabilité visuelle" },
      { href: "https://developer.chrome.com/docs/devtools/performance", label: "Chrome DevTools : enregistrer une trace Performance" },
    ],
  },
  redesign: {
    slug: "refonte-site-web",
    title: "Refonte de site : les vérifications techniques avant et après publication",
    description: "Préparez la recette d’une refonte : anciennes URL, indexation, formulaires, performance et suivi après mise en ligne. Avec une grille de contrôle téléchargeable.",
    eyebrow: "Mise en ligne · Checklist de recette",
    readingMinutes: 8,
    sources: [
      { href: "https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes", label: "Google : migration avec changement d’URL" },
      { href: "https://developers.google.com/search/docs/crawling-indexing/site-move-no-url-changes", label: "Google : changement d’hébergement sans changement d’URL" },
      { href: "https://developers.google.com/search/docs/crawling-indexing/301-redirects", label: "Google : redirections permanentes et temporaires" },
      { href: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag", label: "Google : directives robots et noindex" },
      { href: "https://www.w3.org/WAI/test-evaluate/easy-checks/", label: "W3C WAI : premières vérifications d’accessibilité" },
    ],
  },
  crawlers: {
    slug: "accessibilite-moteurs-ia",
    title: "Votre page est-elle accessible aux moteurs de recherche et aux assistants IA ?",
    description: "Vérifiez accès public, HTML, robots.txt et indexabilité. Distinguez recherche, entraînement et consultation par une IA, sans confondre accès et citation.",
    eyebrow: "SEO technique · Exploration et IA",
    readingMinutes: 8,
    sources: [
      { href: "https://developers.google.com/search/docs/crawling-indexing/robots/intro", label: "Google : rôle et limites de robots.txt" },
      { href: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag", label: "Google : noindex et contrôles des extraits" },
      { href: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls", label: "Google : signaux de canonicalisation" },
      { href: "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics", label: "Google : exploration et rendu JavaScript" },
      { href: "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide", label: "Google : visibilité dans ses fonctionnalités d’IA générative" },
      { href: "https://developers.openai.com/api/docs/bots", label: "OpenAI : rôles de OAI-SearchBot, GPTBot et ChatGPT-User" },
      { href: "https://www.rfc-editor.org/rfc/rfc9309.html", label: "RFC 9309 : règles du protocole d’exclusion des robots" },
    ],
  },
} as const;
