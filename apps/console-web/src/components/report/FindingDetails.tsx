"use client";
import type { ReactNode } from "react";
import Link from "@/components/PageLink";
import ObservedEvidence from "./ObservedEvidence";
import FindingGuide from "./FindingGuide";
import { correctionGuide } from "@/lib/correctionGuides";
import { useLang } from "@/lib/i18n/LangContext";
import { CATALOGUE_VERSION, cleanEvidence, findingContent } from "./findingCatalogue";
import { expectsScalarMeasurement, findingExplanation } from "./findingExplanation";
import { reportReadingCopy } from "./reportReadingCopy";
import type { Finding } from "./reportModel";
import s from "./FindingDetails.module.scss";

function Question({ number, title, preview, children, open }: {
  number: string; title: string; preview: string; children: ReactNode; open?: boolean;
}) {
  return <details className={s.question} open={open}>
    <summary className={s.questionSummary}>
      <h3 className={s.questionHeading}>
        <span className={s.number} aria-hidden="true">{number}</span>
        <span className={s.questionText}><span className={s.questionTitle}>{title}</span><span className={s.preview}>{preview}</span></span>
        <span className={s.chevron} aria-hidden="true">▾</span>
      </h3>
    </summary>
    <div className={s.answer}>{children}</div>
  </details>;
}

export default function FindingDetails({ finding }: { finding: Finding }) {
  const { t, lang } = useLang();
  const copy = reportReadingCopy[lang], questions = copy.findingQuestions;
  const issue = finding.issue, guide = correctionGuide(issue.id, lang);
  const content = findingContent(issue, lang), explanation = findingExplanation(issue, lang);
  const evidence = issue.structuredEvidence, measure = evidence?.measurement;
  const validMeasure = measure && Number.isFinite(measure.value) && Object.hasOwn(copy.units, measure.unit);
  const source = cleanEvidence(evidence?.source || finding.sources.join(", ")) || "—";
  const confidence = issue.confidence && issue.confidence !== "UNKNOWN" && Object.hasOwn(t.report.priorityCards.confidence, issue.confidence)
    ? t.report.priorityCards.confidence[issue.confidence] : copy.unknownConfidence;
  const observed = evidence?.observed?.version === "observed-evidence-v1" ? evidence.observed : undefined;
  const items = observed?.items ?? [], count = items.length;
  const resourcesOnly = count > 0 && items.every(item => item.kind === "resource");
  const observationPreview = count > 0
    ? (resourcesOnly ? count === 1 ? questions.resourcesOne : questions.resourcesMany : count === 1 ? questions.elementsOne : questions.elementsMany).replace("{n}", count.toLocaleString(lang))
    : content.observation;
  const commonOrigin = resourcesOnly && items.every(item => item.origin && item.origin === items[0].origin)
    ? cleanEvidence(items[0].origin) : undefined;

  return <div className={s.details}>
    <div className={s.questions}>
      <Question number="01" title={questions.observation} preview={observationPreview} open>
        {count > 0 && <p>{content.observation}</p>}
        <dl className={s.observationFacts}>
          {commonOrigin && <div><dt>{questions.commonOrigin}</dt><dd><code>{commonOrigin}</code></dd></div>}
          <div><dt>{copy.source}</dt><dd>{source}</dd></div>
          <div><dt>{t.report.priorityCards.confidenceLabel}</dt><dd>{confidence}</dd></div>
          {validMeasure && <div><dt>{questions.measurement}</dt><dd>
            {issue.id === "runtime.network.bytes_estimated" ? `${copy.estimated}: ` : ""}
            {measure.value.toLocaleString(lang, { maximumSignificantDigits: 6 })} {copy.units[measure.unit]}
          </dd></div>}
        </dl>
        {!validMeasure && expectsScalarMeasurement(issue) && <p className={s.context}>{copy.missingMeasure}</p>}
        {content.missingInformation && <p className={s.context}>{content.missingInformation}</p>}
      </Question>
      <Question number="02" title={questions.impact} preview={content.impact}>
        <FindingGuide issue={issue} lang={lang} parts={['limits']} heading={4}/>
      </Question>
      <Question number="03" title={questions.action} preview={explanation.summary ?? explanation.steps[0] ?? content.recommendation}>
        <FindingGuide issue={issue} lang={lang} parts={['correction']} showHeadings={false}/>
        {guide && <p><Link href={guide.href}>{lang === "fr" ? "En savoir plus" : "Learn more"} : {guide.label}</Link></p>}
      </Question>
      <Question number="04" title={questions.verification} preview={questions.verificationPreview}>
        <FindingGuide issue={issue} lang={lang} parts={['verification']} showHeadings={false}/>
      </Question>
    </div>
    <details className={s.evidence}>
      <summary className={s.evidenceSummary}><span>{questions.evidence}</span><span className={s.evidenceToggle} aria-hidden="true"/></summary>
      <div className={s.evidenceBody}>
        <ObservedEvidence evidence={observed} lang={lang}/>
        {issue.evidence && <p>{cleanEvidence(issue.evidence)}</p>}
        <section className={s.technical}>
          <h3>{questions.technical}</h3>
          <p>{copy.technicalTitle}: {cleanEvidence(issue.title)}</p>
          {issue.impact && <p>{copy.originalObservation}: {cleanEvidence(issue.impact)}</p>}
          {issue.id && <p>{copy.technicalId}: <code>{cleanEvidence(issue.id)}</code></p>}
          <p>{copy.source}: {source}</p>
          <p>{t.report.priorityCards.confidenceLabel} {confidence}</p>
          <p>{copy.catalogueVersion}: {CATALOGUE_VERSION}</p>
          {!!evidence?.details?.length && <dl className={s.rawFacts}>{evidence.details.map((detail, index) =>
            <div key={index}><dt><code>{detail.key === "score" && issue.id?.startsWith("lighthouse.audit.") ? copy.lighthouseRatio : cleanEvidence(detail.key)}</code></dt><dd>{cleanEvidence(detail.text)}</dd></div>)}</dl>}
        </section>
        <FindingGuide issue={issue} lang={lang} parts={['detection', 'reference']}/>
      </div>
    </details>
  </div>;
}
