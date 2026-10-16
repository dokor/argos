import DiagnosticPage from "@/components/marketing/DiagnosticPage";
import { diagnosticPages, diagnosticRoutes } from "@/components/marketing/diagnosticPages";
import { localizedMetadata } from "@/lib/i18n/metadata";

const content = diagnosticPages.conversion.fr;
export const metadata = localizedMetadata(diagnosticRoutes.conversion, "fr", content.metaTitle, content.description);
export default function Page() { return <DiagnosticPage topic="conversion" lang="fr" />; }
