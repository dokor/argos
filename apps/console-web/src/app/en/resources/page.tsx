import { requestMetadata } from "@/lib/i18n/server";
export { default } from "@/app/(fr)/ressources/page";
import { localizedMetadata } from "@/lib/i18n/metadata";
export async function generateMetadata() { return requestMetadata(localizedMetadata("/ressources", "en", "Website audit resources", "Argos guides and diagnostics: technical audits, digital accessibility and website analysis for small businesses and online stores.")); }
