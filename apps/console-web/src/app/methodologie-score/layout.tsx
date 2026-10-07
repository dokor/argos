import type { Metadata } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");
const pageUrl = `${siteUrl}/methodologie-score`;
const title = "Comment est calculé le score d'audit Argos ?";
const description = "Comprendre le score d'audit de site web Argos : contrôles, poids, quatre domaines, résultats partiels et différence avec Lighthouse. Exemple chiffré du barème v11.";

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

export default function ScoreMethodologyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
