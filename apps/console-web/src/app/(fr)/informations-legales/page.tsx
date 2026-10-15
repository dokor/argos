import type { Metadata } from "next";
import Page from "@/components/marketing/LegalPage";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata: Metadata = localizedMetadata(
  "/informations-legales", "fr", "Informations sur le service Argos",
  "Éditeur, hébergement en France, contact et licence du service Argos.",
);
export default Page;
