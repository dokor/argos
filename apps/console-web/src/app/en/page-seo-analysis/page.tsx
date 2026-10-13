import TopicAuditPage from "@/components/marketing/TopicAuditPage";
import { englishTopicAudits } from "@/components/marketing/englishTopicAudits";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata = localizedMetadata("/analyse-seo-page", "en", "Free technical SEO analysis of a page", "Check the title, description, HTML structure and indexability signals of a URL with Argos, without a ranking promise.");

export default function Page() {
  return <TopicAuditPage content={englishTopicAudits.seo} lang="en" />;
}

