import TechnicalGuidePage from "@/components/marketing/TechnicalGuidePage";
import { technicalGuides } from "@/lib/technicalGuides";
import { localizedMetadata } from "@/lib/i18n/metadata";
const c = technicalGuides.lcp.en;
export const metadata = localizedMetadata("/guides/lcp-lent", "en", c.title, c.description);
export default function Page() { return <TechnicalGuidePage guide="lcp" lang="en" />; }
