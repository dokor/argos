import type { Metadata } from "next";
import fr from "@/lib/i18n/fr.json";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr";
const FAQ_URL = `${SITE_URL}/faq`;

// Metadata is static (server-rendered) so it uses the canonical French copy,
// like the rest of the site. The visible content is still translated client-side.
export const metadata: Metadata = {
  title: fr.faq.meta.title,
  description: fr.faq.meta.description,
  alternates: { canonical: FAQ_URL },
  openGraph: {
    type: "website",
    url: FAQ_URL,
    title: fr.faq.meta.title,
    description: fr.faq.meta.description,
  },
  twitter: {
    card: "summary_large_image",
    title: fr.faq.meta.title,
    description: fr.faq.meta.description,
  },
};

// FAQPage structured data — helps search engines surface the Q&A directly.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: fr.faq.categories.flatMap((category) =>
    category.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    }))
  ),
};

export default function FaqLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
