import type { Metadata } from "next";
import TermsPage from "@/components/marketing/TermsPage";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata: Metadata = localizedMetadata(
  "/conditions-utilisation", "fr", "Conditions d’utilisation d’Argos",
  "Conditions d’utilisation du service Argos : audits de pages publiques, comptes, accès aux rapports, limites et contact.",
);
export default TermsPage;
