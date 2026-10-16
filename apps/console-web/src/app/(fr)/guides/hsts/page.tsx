import TechnicalGuidePage from "@/components/marketing/TechnicalGuidePage";
import { technicalGuides } from "@/lib/technicalGuides";
import { localizedMetadata } from "@/lib/i18n/metadata";
const c = technicalGuides.hsts.fr;
export const metadata = localizedMetadata("/guides/hsts", "fr", c.title, c.description);
export default function Page() { return <TechnicalGuidePage guide="hsts" lang="fr" />; }
