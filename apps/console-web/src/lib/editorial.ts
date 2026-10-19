import { technicalGuides } from "./technicalGuides";
// Stable dates refer to first source publication and substantive content revision.
// Evidence and revision rules: docs/product/editorial-provenance.md.
export type EditorialRecord = { firstVersion: string; revised: string; translatedAt?: string; minutes: number; sourcesAnchor: string; sourceUrls: string[] };
export const editorialPages: Record<string, EditorialRecord> = {
  "/guides/checklist-audit-ecommerce": {
    firstVersion: "2026-10-19",
    revised: "2026-10-19",
    translatedAt: "2026-10-19",
    minutes: 9,
    sourcesAnchor: "#references",
    sourceUrls: [
      "https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure",
      "https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites",
      "https://developers.google.com/search/docs/appearance/structured-data/product",
      "https://web.dev/articles/vitals",
      "https://www.w3.org/WAI/tutorials/forms/validation/",
    ],
  },
  ...Object.fromEntries(Object.values(technicalGuides).map(guide => [guide.route, {
    firstVersion: "2026-10-16", revised: "2026-10-16", translatedAt: "2026-10-16",
    minutes: 6, sourcesAnchor: "#references", sourceUrls: guide.sources.map(source => source.href),
  }])),
  "/ressources/audit-wordpress": {
    firstVersion: "2026-10-16", revised: "2026-10-16", translatedAt: "2026-10-16", minutes: 4,
    sourcesAnchor: "#references",
    sourceUrls: ["https://developer.wordpress.org/advanced-administration/performance/optimization/"],
  },
  "/ressources/audit-shopify": {
    firstVersion: "2026-10-16", revised: "2026-10-16", translatedAt: "2026-10-16", minutes: 4,
    sourcesAnchor: "#references",
    sourceUrls: ["https://shopify.dev/docs/storefronts/themes/best-practices/performance"],
  },
  "/ressources/pourquoi-mon-site-ne-convertit-pas": {
    firstVersion: "2026-10-16", revised: "2026-10-16", translatedAt: "2026-10-16", minutes: 4,
    sourcesAnchor: "#references",
    sourceUrls: ["https://support.google.com/analytics/answer/9267568?hl=fr", "https://www.w3.org/WAI/test-evaluate/tools/"],
  },
  "/guides/checklist-audit-site-web": {
    "translatedAt": "2026-10-11",
    "firstVersion": "2026-10-07",
    "revised": "2026-10-07",
    "minutes": 9,
    "sourcesAnchor": "#references",
    "sourceUrls": [
      "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
      "https://web.dev/articles/vitals-tools",
      "https://www.w3.org/WAI/WCAG22/quickref/"
    ]
  },
  "/methodologie-score": {
    "translatedAt": "2026-10-11",
    "firstVersion": "2026-10-07",
    "revised": "2026-10-10",
    "minutes": 6,
    "sourcesAnchor": "#limites",
    "sourceUrls": [
      "https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/",
      "https://owasp.org/projects/secure-headers-project",
      "https://www.w3.org/WAI/standards-guidelines/wcag/"
    ]
  },
  "/ressources/audit-technique-gratuit": {
    "translatedAt": "2026-10-11",
    "firstVersion": "2026-10-06",
    "revised": "2026-10-10",
    "minutes": 8,
    "sourcesAnchor": "#references",
    "sourceUrls": [
      "https://developer.chrome.com/docs/lighthouse/overview/",
      "https://owasp.org/projects/secure-headers-project",
      "https://www.w3.org/WAI/test-evaluate/tools/"
    ]
  },
  "/ressources/accessibilite-numerique": {
    "translatedAt": "2026-10-11",
    "firstVersion": "2026-10-06",
    "revised": "2026-10-06",
    "minutes": 10,
    "sourcesAnchor": "#references",
    "sourceUrls": [
      "https://accessibilite.numerique.gouv.fr/",
      "https://accessibilite.numerique.gouv.fr/obligations/champ-application/",
      "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048050174",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019L0882",
      "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite",
      "https://www.w3.org/WAI/standards-guidelines/wcag/"
    ]
  },
  "/test-vitesse-site-web": {
    "translatedAt": "2026-10-13",
    "firstVersion": "2026-10-10",
    "revised": "2026-10-10",
    "minutes": 4,
    "sourcesAnchor": "#references",
    "sourceUrls": [
      "https://web.dev/articles/lcp",
      "https://web.dev/articles/fcp"
    ]
  },
  "/analyse-seo-page": {
    "translatedAt": "2026-10-13",
    "firstVersion": "2026-10-10",
    "revised": "2026-10-10",
    "minutes": 4,
    "sourcesAnchor": "#references",
    "sourceUrls": [
      "https://developers.google.com/search/docs/appearance/title-link",
      "https://developers.google.com/search/docs/appearance/snippet"
    ]
  },
  "/verifier-entetes-securite": {
    "translatedAt": "2026-10-13",
    "firstVersion": "2026-10-10",
    "revised": "2026-10-10",
    "minutes": 4,
    "sourcesAnchor": "#references",
    "sourceUrls": [
      "https://owasp.org/projects/secure-headers-project",
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP"
    ]
  },
  "/test-accessibilite-site-web": {
    "translatedAt": "2026-10-13",
    "firstVersion": "2026-10-11",
    "revised": "2026-10-11",
    "minutes": 4,
    "sourcesAnchor": "#references",
    "sourceUrls": [
      "https://www.w3.org/WAI/test-evaluate/tools/",
      "https://www.w3.org/WAI/tutorials/images/"
    ]
  }
};
