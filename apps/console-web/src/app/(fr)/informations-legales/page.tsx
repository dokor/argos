import Page from "@/components/marketing/LegalPage";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/i18n/metadata";
export const metadata: Metadata = { title: "Informations sur le service Argos", description: "Éditeur, hébergement en France, contact et licence du service Argos.", alternates: { canonical: siteUrl + "/informations-legales" }, openGraph: { title: "Informations sur le service Argos", description: "Éditeur, hébergement en France, contact et licence du service Argos.", url: siteUrl + "/informations-legales" } };
export default Page;
