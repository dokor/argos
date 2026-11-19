import { requestMetadata, requestLanguage } from "@/lib/i18n/server";
import TopicAuditPage from "@/components/marketing/TopicAuditPage";
import { englishTopicAudits, localizedTopicAudit } from "@/components/marketing/englishTopicAudits";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() { return requestMetadata(localizedMetadata("/test-vitesse-site-web", "en", "Free website page speed test", "Analyze a URL with Argos: loading, Lighthouse findings, units and the limits of laboratory measurements.")); }

export default async function Page() {
  return <TopicAuditPage content={localizedTopicAudit(englishTopicAudits.speed, await requestLanguage())} lang={await requestLanguage()} />;
}

