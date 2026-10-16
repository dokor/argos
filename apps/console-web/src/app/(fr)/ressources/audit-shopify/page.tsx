import DiagnosticPage from "@/components/marketing/DiagnosticPage";
import { diagnosticPages, diagnosticRoutes } from "@/components/marketing/diagnosticPages";
import { localizedMetadata } from "@/lib/i18n/metadata";

const content = diagnosticPages.shopify.fr;
export const metadata = localizedMetadata(diagnosticRoutes.shopify, "fr", content.metaTitle, content.description);
export default function Page() { return <DiagnosticPage topic="shopify" lang="fr" />; }
