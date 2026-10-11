import AudiencePage from "@/components/marketing/AudiencePage";
import fr from "@/lib/i18n/fr.json";
import { localizedMetadata } from "@/lib/i18n/metadata";
export const metadata = localizedMetadata("/ressources/audit-site-ecommerce", "fr", fr.marketing.ecommerce.meta.title, fr.marketing.ecommerce.meta.description);
export default function Page() { return <AudiencePage audience="ecommerce" />; }
