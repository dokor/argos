import TechnicalGuidePage from "@/components/marketing/TechnicalGuidePage";
import { technicalGuides } from "@/lib/technicalGuides";
import { localizedMetadata } from "@/lib/i18n/metadata";
const c = technicalGuides.lcp.fr;
export const metadata = localizedMetadata("/guides/lcp-lent", "fr", c.title, c.description);
export default function Page() { return <TechnicalGuidePage guide="lcp" lang="fr" />; }
