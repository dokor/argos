/* eslint-disable @next/next/no-head-element -- Shared root document for the French and English root layouts. */
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LangProvider } from "@/lib/i18n/LangContext";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import ProductAnalytics from "@/components/analytics/ProductAnalytics";
import ClientErrorLogger from "@/components/ClientErrorLogger";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
import "@/app/globals.css";
import type { Lang } from "@/lib/i18n/routes";

// Applique le thème avant le premier paint pour éviter un flash (FOUC) :
// choix persistant sinon préférence système. Exécuté inline dans <head>.
const themeInitScript = `(function(){try{var t=localStorage.getItem('argos-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");
const TITLE = fr.layout.title;
const DESCRIPTION = fr.layout.description;

export const frenchMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | Argos",
  },
  description: DESCRIPTION,
  keywords: [
    "audit site web",
    "SEO",
    "sécurité HTTP",
    "performance web",
    "Lighthouse",
    "analyse URL",
    "rapport gratuit",
  ],
  authors: [{ name: "Antoine LE LOUËT", url: "https://www.linkedin.com/in/antoine-le-lou%C3%ABt" }],
  creator: "Antoine LE LOUËT",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "Argos",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Argos - Analyseur de site web",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
    creator: "@antoinelelouet",
  },
  alternates: {
    canonical: SITE_URL,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Argos",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  author: {
    "@type": "Person",
    name: "Antoine LE LOUËT",
    url: "https://www.linkedin.com/in/antoine-le-lou%C3%ABt",
  },
};

export default function SiteDocument({
  lang = "fr",
  children,
}: Readonly<{
  children: React.ReactNode;
  lang?: Lang;
}>) {
  return (
    <html lang={lang}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...jsonLd, url: lang === "en" ? SITE_URL + "/en" : SITE_URL, inLanguage: lang, description: lang === "en" ? en.layout.description : DESCRIPTION }).replace(/</g, "\\u003c") }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ClientErrorLogger />
        <ThemeProvider>
          <LangProvider initialLang={lang}><ProductAnalytics />{children}</LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
