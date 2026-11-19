import { requestMetadata, requestLanguage } from "@/lib/i18n/server";
import TechnicalGuidePage from "@/components/marketing/TechnicalGuidePage";
import { technicalGuides } from "@/lib/technicalGuides";
import { localizedMetadata } from "@/lib/i18n/metadata";
const c = technicalGuides.hsts.en;
export async function generateMetadata() { return requestMetadata(localizedMetadata("/guides/hsts", "en", c.title, c.description)); }
export default async function Page() { return <TechnicalGuidePage guide="hsts" lang={await requestLanguage()} />; }
