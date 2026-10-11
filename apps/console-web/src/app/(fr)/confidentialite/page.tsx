import Page from "@/components/marketing/PrivacyPage";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/i18n/metadata";
export const metadata: Metadata = { title: "Confidentialité et accès aux rapports Argos", description: "Données reçues, accès par lien, limites de conservation et contact de l’opérateur Argos.", alternates: { canonical: siteUrl + "/confidentialite" }, openGraph: { title: "Confidentialité et accès aux rapports Argos", description: "Données reçues, accès par lien, limites de conservation et contact de l’opérateur Argos.", url: siteUrl + "/confidentialite" } };
export default Page;
