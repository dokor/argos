import type { Metadata } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");
const pageUrl = `${siteUrl}/guides/checklist-audit-site-web`;
const title = "Checklist d’audit de site web : 6 étapes pratiques";
const description = "Suivez six vérifications manuelles : accès, indexabilité, HTML, HTTPS, performance et accessibilité. Avec les limites des contrôles automatiques Argos.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "article",
    url: pageUrl,
    title,
    description,
    locale: "fr_FR",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Argos, analyseur de site web" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export default function ChecklistAuditLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
