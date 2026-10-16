import DiagnosticPage from "@/components/marketing/DiagnosticPage";
import { diagnosticPages, diagnosticRoutes } from "@/components/marketing/diagnosticPages";
import { localizedMetadata } from "@/lib/i18n/metadata";

const content = diagnosticPages.wordpress.fr;
export const metadata = localizedMetadata(diagnosticRoutes.wordpress, "fr", content.metaTitle, content.description);
export default function Page() { return <DiagnosticPage topic="wordpress" lang="fr" />; }
