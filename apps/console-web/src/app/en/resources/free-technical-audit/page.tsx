import { requestMetadata } from "@/lib/i18n/server";
export { default } from "@/app/(fr)/ressources/audit-technique-gratuit/page";
import { localizedMetadata } from "@/lib/i18n/metadata";
export async function generateMetadata() { return requestMetadata(localizedMetadata("/ressources/audit-technique-gratuit", "en", "Free technical website audit", "Analyse one public URL with Argos: HTTP, HTML, performance, accessibility and security, with method, evidence and limits.")); }
