import { requestMetadata, requestLanguage } from "@/lib/i18n/server";
import TopicAuditPage from "@/components/marketing/TopicAuditPage";
import { englishTopicAudits, localizedTopicAudit } from "@/components/marketing/englishTopicAudits";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() { return requestMetadata(localizedMetadata("/verifier-entetes-securite", "en", "Check a page’s security headers", "Analyze CSP, HSTS and other headers observed on a URL with Argos: evidence, contextual corrections and limits.")); }

export default async function Page() {
  return <TopicAuditPage content={localizedTopicAudit(englishTopicAudits.security, await requestLanguage())} lang={await requestLanguage()} />;
}

