import TopicAuditPage from "@/components/marketing/TopicAuditPage";
import { englishTopicAudits } from "@/components/marketing/englishTopicAudits";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata = localizedMetadata("/test-accessibilite-site-web", "en", "Automated accessibility test of a page", "Identify automated accessibility signals on a URL with Argos and the complementary human checks, without a compliance certificate.");

export default function Page() {
  return <TopicAuditPage content={englishTopicAudits.accessibility} lang="en" />;
}

