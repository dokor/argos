import { requestMetadata, requestLanguage } from "@/lib/i18n/server";
import DiagnosticPage from "@/components/marketing/DiagnosticPage";
import { diagnosticPages, diagnosticRoutes } from "@/components/marketing/diagnosticPages";
import { localizedMetadata } from "@/lib/i18n/metadata";

const content = diagnosticPages.wordpress.en;
export async function generateMetadata() { return requestMetadata(localizedMetadata(diagnosticRoutes.wordpress, "en", content.metaTitle, content.description)); }
export default async function Page() { return <DiagnosticPage topic="wordpress" lang={await requestLanguage()} />; }
