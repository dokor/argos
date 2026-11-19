import { requestMetadata } from "@/lib/i18n/server";
import Page from "@/components/marketing/PrivacyPage";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() { return requestMetadata(localizedMetadata(
  "/confidentialite", "en", "Privacy and access to Argos reports",
  "Data collected, link-based report access, retention limits and how to contact the Argos operator.",
)); }
export default Page;
