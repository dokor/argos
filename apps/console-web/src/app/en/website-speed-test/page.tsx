import TopicAuditPage from "@/components/marketing/TopicAuditPage";
import { englishTopicAudits } from "@/components/marketing/englishTopicAudits";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata = localizedMetadata("/test-vitesse-site-web", "en", "Free website page speed test", "Analyze a URL with Argos: loading, Lighthouse findings, units and the limits of laboratory measurements.");

export default function Page() {
  return <TopicAuditPage content={englishTopicAudits.speed} lang="en" />;
}

