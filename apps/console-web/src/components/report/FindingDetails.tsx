"use client";
import Link from "next/link";
import { correctionGuide } from "@/lib/correctionGuides";
import { useLang } from "@/lib/i18n/LangContext";
import { CATALOGUE_VERSION, cleanEvidence, findingContent } from "./findingCatalogue";
import { reportReadingCopy } from "./reportReadingCopy";
import type { Finding } from "./reportModel";
import s from "./IssuesByCategory.module.scss";

export default function FindingDetails({ finding }: { finding: Finding }) {
  const { t, lang } = useLang(); const copy = reportReadingCopy[lang];
  const issue = finding.issue; const guide = correctionGuide(issue.id, lang); const content = findingContent(issue, lang);
  const evidence = issue.structuredEvidence;
  const measure = evidence?.measurement;
  const validMeasure = measure && Number.isFinite(measure.value) && Object.hasOwn(copy.units, measure.unit);
  return <div className={s.issueDetail}>
    <div className={s.detailBlock}><h3 className={s.detailBlockLabel}>{copy.impact}</h3><p>{content.impact}</p></div>
    <div className={s.detailBlock}><h3 className={s.detailBlockLabel}>{copy.observation}</h3><p>{content.observation}</p>
      <p>{copy.technicalTitle}: {cleanEvidence(issue.title)}</p>
      {issue.impact && <p>{copy.originalObservation}: {cleanEvidence(issue.impact)}</p>}
      {issue.id && <p>{copy.technicalId}: <code>{cleanEvidence(issue.id)}</code></p>}
      <p>{copy.source}: {cleanEvidence(evidence?.source || finding.sources.join(", ")) || "—"}</p>
      <p>{t.report.priorityCards.confidenceLabel} {issue.confidence && issue.confidence !== "UNKNOWN" && Object.hasOwn(t.report.priorityCards.confidence, issue.confidence)
        ? t.report.priorityCards.confidence[issue.confidence] : copy.unknownConfidence}</p>
      <p>{copy.catalogueVersion}: {CATALOGUE_VERSION}</p>
    </div>
    <div className={s.detailBlock}><h3 className={s.detailBlockLabel}>{copy.evidence}</h3>
      {validMeasure ? <p>{issue.id === "runtime.network.bytes_estimated" ? `${copy.estimated}: ` : ""}
        {measure.value.toLocaleString(lang, { maximumSignificantDigits: 6 })} {copy.units[measure.unit]}</p> : <p>{copy.missingMeasure}</p>}
      {evidence?.details?.length ? <dl>{evidence.details.slice(0, 20).map((detail, index) =>
        <div key={index}><dt><code>{detail.key === "score" && issue.id?.startsWith("lighthouse.audit.") ? copy.lighthouseRatio : cleanEvidence(detail.key)}</code></dt><dd>{cleanEvidence(detail.text)}</dd></div>)}</dl>
        : issue.evidence && <p>{cleanEvidence(issue.evidence)}</p>}
    </div>
    <div className={s.detailBlock}><h3 className={s.detailBlockLabel}>{copy.recommendation}</h3><p>{content.recommendation}</p>{guide && <p><Link href={guide.href}>{lang === "fr" ? "En savoir plus" : "Learn more"} : {guide.label}</Link></p>}</div>
    <div className={s.detailBlock}><h3 className={s.detailBlockLabel}>{copy.verification}</h3><p>{content.verification}</p></div>
  </div>;
}
