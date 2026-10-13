import type { Metadata } from "next";
import Page from "@/components/marketing/TermsPage";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata: Metadata = localizedMetadata(
  "/conditions-utilisation", "en", "Argos terms of use",
  "Terms of use for Argos: public page audits, accounts, report access, limits and contact.",
);
export default Page;
