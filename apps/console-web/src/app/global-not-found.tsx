import SiteDocument from "@/components/site/SiteDocument";
import NotFound from "@/app/(fr)/not-found";
import { requestLanguage } from "@/lib/i18n/server";

// Multiple root layouts need a complete document for unmatched URLs.
export default async function GlobalNotFound() {
  return <SiteDocument lang={await requestLanguage()}><NotFound /></SiteDocument>;
}
