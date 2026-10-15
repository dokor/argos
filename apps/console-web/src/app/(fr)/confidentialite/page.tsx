import type { Metadata } from "next";
import Page from "@/components/marketing/PrivacyPage";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata: Metadata = localizedMetadata(
  "/confidentialite", "fr", "Confidentialité et accès aux rapports Argos",
  "Données reçues, accès par lien, limites de conservation et contact de l’opérateur Argos.",
);
export default Page;
