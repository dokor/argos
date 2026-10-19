import EcommerceAuditArticle, { ecommerceAuditMetadata } from "@/components/marketing/EcommerceAuditArticle";

export const metadata = ecommerceAuditMetadata("fr");
export default function Page() { return <EcommerceAuditArticle lang="fr" />; }
