import { requestMetadata } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
export { default } from "@/app/(fr)/exemple-rapport/page";
export async function generateMetadata() { return requestMetadata(localizedMetadata("/exemple-rapport", "en", "Argos example report: evidence and before/after corrections", "A worked example on a controlled demo page: verifiable HTML findings, before/after corrections and priorities.")); }
