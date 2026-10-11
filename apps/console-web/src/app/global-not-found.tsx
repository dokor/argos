import SiteDocument from "@/components/site/SiteDocument";
import NotFound from "@/app/(fr)/not-found";

// Multiple root layouts need a complete document for unmatched URLs.
export default function GlobalNotFound() {
  return <SiteDocument lang="fr"><NotFound /></SiteDocument>;
}
