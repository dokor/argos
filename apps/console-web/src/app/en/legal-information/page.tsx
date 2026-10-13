import type { Metadata } from "next";
import Page from "@/components/marketing/LegalPage";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata: Metadata = localizedMetadata(
  "/informations-legales", "en", "Argos service information",
  "Publisher, hosting in France, contact and licence for the Argos service.",
);
export default Page;
