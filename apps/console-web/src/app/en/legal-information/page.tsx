import { requestMetadata } from "@/lib/i18n/server";
import Page from "@/components/marketing/LegalPage";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() { return requestMetadata(localizedMetadata(
  "/informations-legales", "en", "Argos service information",
  "Publisher, hosting in France, contact and licence for the Argos service.",
)); }
export default Page;
