import { requestMetadata, requestLanguage } from "@/lib/i18n/server";
import EcommerceAuditArticle, { ecommerceAuditMetadata } from "@/components/marketing/EcommerceAuditArticle";

export async function generateMetadata() { return requestMetadata(ecommerceAuditMetadata("en")); }
export default async function Page() { return <EcommerceAuditArticle lang={await requestLanguage()} />; }
