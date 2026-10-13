import type { ReportIntroduction } from "./types";
import type { ReportModel } from "./reportModel";
import type { Lang } from "@/lib/i18n/routes";
import { findingContent } from "./findingCatalogue";
import { introductionCopy } from "./introductionCopy";
import s from "./ReportIntroduction.module.scss";

/** Shared anonymous reading and owner preview: no account navigation here. */
export default function ReportIntroductionView({ note, model, lang, onSelectFinding }: { note: ReportIntroduction; model: ReportModel; lang: Lang; onSelectFinding?: (key: string) => void }) {
  const copy = introductionCopy[lang]; const date = new Date(note.publishedAt);
  return <section className={s.note} aria-label={copy.title}>
    <h2>{copy.title}</h2><p className={s.meta}>{note.author}{Number.isFinite(date.getTime()) && <> · <time dateTime={note.publishedAt}>{date.toLocaleDateString(lang, { timeZone: "UTC" })}</time></>}</p>
    <p className={s.prose}>{note.context}</p>
    <ul>{note.findingKeys.map(key => { const finding = model.findings.find(f => f.key === key); return finding && <li key={key}>
      <a href={`#${finding.anchor}`} onClick={event => { if (onSelectFinding) { event.preventDefault(); onSelectFinding(key); } }}>{findingContent(finding.issue, lang).title}</a>
    </li>; })}</ul>
    <h3>{copy.next}</h3><p className={s.prose}>{note.nextStep}</p><p className={s.meta}>{copy.human}</p>
  </section>;
}
