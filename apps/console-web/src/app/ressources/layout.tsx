import type { Metadata } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");
const url = `${siteUrl}/ressources`;
const title = "Ressources pour auditer votre site web";
const description = "Guides et diagnostics Argos : audit technique gratuit, accessibilité numérique et analyses adaptées aux sites PME ou e-commerce.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { type: "website", url, title, description, locale: "fr_FR", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export default function ResourcesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
