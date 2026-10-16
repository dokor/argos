import DiagnosticPage from "@/components/marketing/DiagnosticPage";
import { diagnosticPages, diagnosticRoutes } from "@/components/marketing/diagnosticPages";
import { localizedMetadata } from "@/lib/i18n/metadata";

const content = diagnosticPages.conversion.en;
export const metadata = localizedMetadata(diagnosticRoutes.conversion, "en", content.metaTitle, content.description);
export default function Page() { return <DiagnosticPage topic="conversion" lang="en" />; }
