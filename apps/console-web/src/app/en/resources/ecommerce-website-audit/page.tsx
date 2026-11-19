import { requestMetadata } from "@/lib/i18n/server";
export { default } from "@/app/(fr)/ressources/audit-site-ecommerce/page";
import { localizedMetadata } from "@/lib/i18n/metadata";
import en from "@/lib/i18n/en.json";
export async function generateMetadata() { return requestMetadata(localizedMetadata("/ressources/audit-site-ecommerce", "en", en.marketing.ecommerce.meta.title, en.marketing.ecommerce.meta.description)); }
