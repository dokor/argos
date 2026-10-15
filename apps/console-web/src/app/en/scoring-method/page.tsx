import ScoreMethodologyPage from "@/components/marketing/ScoreMethodologyPage";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const metadata = localizedMetadata("/methodologie-score", "en", "How is the Argos website audit score calculated?", "Understand weighted checks, four domains, partial coverage and Lighthouse differences, with a worked example of Argos policy v12.");

export default function Page() {
  return <ScoreMethodologyPage lang="en" />;
}
