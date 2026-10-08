import type { Metadata } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");
const pageUrl = `${siteUrl}/ressources/audit-technique-gratuit`;
const title = "Audit technique gratuit de site web";
const description = "Analysez une URL publique avec Argos : HTTP, HTML, performance, accessibilité et sécurité. Découvrez la méthode, les limites et recevez un rapport privé.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    title,
    description,
    locale: "fr_FR",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Argos, analyseur de site web" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export default function AuditTechniqueLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
