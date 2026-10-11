import { localizedMetadata } from "@/lib/i18n/metadata";
import ExampleReport from "@/components/marketing/ExampleReport";
export const metadata = localizedMetadata("/exemple-rapport", "fr", "Exemple de rapport Argos : preuves et corrections avant/après", "Un exemple pédagogique sur une page de démonstration contrôlée : constats HTML vérifiables, corrections avant/après et ordre de priorité.");
export default function ExampleReportPage() { return <ExampleReport />; }
