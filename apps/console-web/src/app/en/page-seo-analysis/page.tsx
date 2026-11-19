import { requestMetadata, requestLanguage } from "@/lib/i18n/server";
import TopicAuditPage from "@/components/marketing/TopicAuditPage";
import { englishTopicAudits, localizedTopicAudit } from "@/components/marketing/englishTopicAudits";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() { return requestMetadata(localizedMetadata("/analyse-seo-page", "en", "Free technical SEO analysis of a page", "Check the title, description, HTML structure and indexability signals of a URL with Argos, without a ranking promise.")); }

export default async function Page() {
  return <TopicAuditPage content={localizedTopicAudit(englishTopicAudits.seo, await requestLanguage())} lang={await requestLanguage()} />;
}

