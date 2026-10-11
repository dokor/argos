import ExampleReport from "@/components/marketing/ExampleReport";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata = localizedMetadata("/exemple-rapport", "en", "Argos example report: evidence and before/after corrections", "An educational report on a controlled demo page: verifiable HTML findings, before/after corrections and priorities.");
export default function ExampleReportPage() { return <ExampleReport />; }
