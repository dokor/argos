import { requestMetadata, requestLanguage } from "@/lib/i18n/server";
import TopicAuditPage from "@/components/marketing/TopicAuditPage";
import { englishTopicAudits, localizedTopicAudit } from "@/components/marketing/englishTopicAudits";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() { return requestMetadata(localizedMetadata("/test-accessibilite-site-web", "en", "Automated accessibility test of a page", "Identify automated accessibility signals on a URL with Argos and the complementary human checks, without a compliance certificate.")); }

export default async function Page() {
  return <TopicAuditPage content={localizedTopicAudit(englishTopicAudits.accessibility, await requestLanguage())} lang={await requestLanguage()} />;
}

