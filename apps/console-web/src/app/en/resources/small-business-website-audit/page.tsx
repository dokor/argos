import { requestMetadata } from "@/lib/i18n/server";
export { default } from "@/app/(fr)/ressources/audit-site-pme/page";
import { localizedMetadata } from "@/lib/i18n/metadata";
import en from "@/lib/i18n/en.json";
export async function generateMetadata() { return requestMetadata(localizedMetadata("/ressources/audit-site-pme", "en", en.marketing.pme.meta.title, en.marketing.pme.meta.description)); }
