import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr";
const articleUrl = `${siteUrl}/accessibilite-numerique`;
const title = "Accessibilité numérique : RGAA, EAA, obligations et sanctions";
const description =
  "RGAA et EAA en France : découvrez les principes de l’accessibilité numérique, les organismes et services concernés, les obligations et les sanctions applicables.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: articleUrl },
  openGraph: {
    type: "article",
    url: articleUrl,
    title,
    description,
    locale: "fr_FR",
    publishedTime: "2026-10-06",
    modifiedTime: "2026-10-06",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Argos, analyseur de site web" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: title,
  description,
  inLanguage: "fr-FR",
  datePublished: "2026-10-06",
  dateModified: "2026-10-06",
  mainEntityOfPage: articleUrl,
  image: `${siteUrl}/og.png`,
  author: { "@type": "Person", name: "Antoine LE LOUËT" },
  publisher: { "@type": "Organization", name: "Argos", url: siteUrl },
  citation: [
    "https://accessibilite.numerique.gouv.fr/",
    "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019L0882",
    "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite",
  ],
};

export default function AccessibilityArticleLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
