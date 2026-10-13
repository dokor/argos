import TopicAuditPage from "@/components/marketing/TopicAuditPage";
import { englishTopicAudits } from "@/components/marketing/englishTopicAudits";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata = localizedMetadata("/verifier-entetes-securite", "en", "Check a page’s security headers", "Analyze CSP, HSTS and other headers observed on a URL with Argos: evidence, contextual corrections and limits.");

export default function Page() {
  return <TopicAuditPage content={englishTopicAudits.security} lang="en" />;
}

