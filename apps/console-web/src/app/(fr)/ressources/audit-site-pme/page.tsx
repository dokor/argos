import AudiencePage from "@/components/marketing/AudiencePage";
import fr from "@/lib/i18n/fr.json";
import { localizedMetadata } from "@/lib/i18n/metadata";
export const metadata = localizedMetadata("/ressources/audit-site-pme", "fr", fr.marketing.pme.meta.title, fr.marketing.pme.meta.description);
export default function Page() { return <AudiencePage audience="pme" />; }
