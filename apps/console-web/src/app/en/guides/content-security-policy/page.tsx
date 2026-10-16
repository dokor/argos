import TechnicalGuidePage from "@/components/marketing/TechnicalGuidePage";
import { technicalGuides } from "@/lib/technicalGuides";
import { localizedMetadata } from "@/lib/i18n/metadata";
const c = technicalGuides.csp.en;
export const metadata = localizedMetadata("/guides/content-security-policy", "en", c.title, c.description);
export default function Page() { return <TechnicalGuidePage guide="csp" lang="en" />; }
