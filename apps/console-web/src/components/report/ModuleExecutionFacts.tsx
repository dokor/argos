import type { Report } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import { reportReadingCopy } from "./reportReadingCopy";

export default function ModuleExecutionFacts({ scores, lang }: { scores: Report["scores"]; lang: Lang }) {
  const m = scores.moduleExecution;
  const c = lang === "fr"
    ? { progress: "Progression terminale des modules", failed: "Modules en échec", partial: "Collectes partielles", skipped: "Modules ignorés", active: "Modules en attente ou en cours" }
    : { progress: "Terminal module progress", failed: "Failed modules", partial: "Partial collections", skipped: "Skipped modules", active: "Pending or running modules" };
  return <>
    {typeof scores.completeness === "number" && <div><dt>{reportReadingCopy[lang].moduleCompleteness}</dt><dd>{scores.completeness} %</dd></div>}
    {m && <>
      <div><dt>{c.progress}</dt><dd>{m.terminalPercent} %</dd></div>
      <div><dt>{c.failed}</dt><dd>{m.failed} / {m.total}</dd></div>
      <div><dt>{c.partial}</dt><dd>{m.partial} / {m.total}</dd></div>
      <div><dt>{c.skipped}</dt><dd>{m.skipped} / {m.total}</dd></div>
      <div><dt>{c.active}</dt><dd>{m.pending + m.running} / {m.total}</dd></div>
    </>}
  </>;
}
