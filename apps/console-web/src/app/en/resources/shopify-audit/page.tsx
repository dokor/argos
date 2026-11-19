import { requestMetadata, requestLanguage } from "@/lib/i18n/server";
import DiagnosticPage from "@/components/marketing/DiagnosticPage";
import { diagnosticPages, diagnosticRoutes } from "@/components/marketing/diagnosticPages";
import { localizedMetadata } from "@/lib/i18n/metadata";

const content = diagnosticPages.shopify.en;
export async function generateMetadata() { return requestMetadata(localizedMetadata(diagnosticRoutes.shopify, "en", content.metaTitle, content.description)); }
export default async function Page() { return <DiagnosticPage topic="shopify" lang={await requestLanguage()} />; }
