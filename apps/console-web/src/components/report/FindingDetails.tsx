"use client";
import Link from "@/components/PageLink";
import ObservedEvidence from "./ObservedEvidence";
import FindingGuide from "./FindingGuide";
import FindingLocation from "./FindingLocation";
import { correctionGuide } from "@/lib/correctionGuides";
import { useLang } from "@/lib/i18n/LangContext";
import { CATALOGUE_VERSION, cleanEvidence, findingContent } from "./findingCatalogue";
import { expectsScalarMeasurement, findingExplanation } from "./findingExplanation";
import { reportReadingCopy } from "./reportReadingCopy";
import type { Finding } from "./reportModel";
import s from "./FindingDetails.module.scss";

export default function FindingDetails({ finding, pageUrl }: { finding: Finding; pageUrl?: string }) {
  const { t, lang } = useLang(), fr=lang==="fr";
  const copy=reportReadingCopy[lang], questions=copy.findingQuestions;
  const issue=finding.issue, guide=correctionGuide(issue.id,lang);
  const content=findingContent(issue,lang), explanation=findingExplanation(issue,lang);
  const evidence=issue.structuredEvidence, measure=evidence?.measurement;
  const validMeasure=measure&&Number.isFinite(measure.value)&&Object.hasOwn(copy.units,measure.unit);
  const source=cleanEvidence(evidence?.source||finding.sources.join(", "))||"—";
  const confidence=issue.confidence&&Object.hasOwn(t.report.priorityCards.confidence,issue.confidence)
    ? t.report.priorityCards.confidence[issue.confidence] : copy.unknownConfidence;
  const observed=evidence?.observed?.version==="observed-evidence-v1"?evidence.observed:undefined;
  return <div className={s.details}>
    <div className={s.questions}>
      <section className={s.question} aria-label={questions.observation}>
        <h3>{questions.observation}</h3>
        <p>{content.observation}</p>
        {validMeasure&&<p className={s.measurement}>{evidence?.details?.some(d=>d.key==='measurementKind'&&d.text==='estimatedSavings')&&(fr?'Économie estimée : ':'Estimated savings: ')}{measure.value.toLocaleString(lang,{maximumSignificantDigits:6})} {copy.units[measure.unit]}</p>}
        {!validMeasure&&expectsScalarMeasurement(issue)&&<p className={s.context}>{copy.missingMeasure}</p>}
        <FindingLocation issue={issue} pageUrl={pageUrl} lang={lang}/>
        {issue.evidence&&!evidence&&<p className={s.sourceObservation}>{cleanEvidence(issue.evidence)}</p>}
        <ObservedEvidence evidence={observed} lang={lang}/>
        {!observed?.items.length&&content.missingInformation&&<p className={s.context}>{content.missingInformation}</p>}
      </section>
      <section className={s.question} aria-label={questions.impact}>
        <h3>{questions.impact}</h3><p>{content.impact}</p>
      </section>
      <section className={s.question} aria-label={questions.action}>
        <h3>{fr?"Que modifier ?":"What should I change?"}</h3>
        {explanation.specific ? <FindingGuide issue={issue} lang={lang} parts={["correction"]} showHeadings={false}/>
          : <><p>{fr?"Aucune procédure spécifique n’est disponible pour ce contrôle.":"No specific procedure is available for this check."}</p>
            {issue.recommendation&&!issue.id?.startsWith('zap.alert.')&&<p>{fr?"Indication de l’outil source":"Source tool guidance"} : {cleanEvidence(issue.recommendation)}</p>}
            <FindingGuide issue={issue} lang={lang} parts={["correction"]} showHeadings={false}/></>}
        {guide&&<p><Link href={guide.href}>{fr?"Guide de correction":"Correction guide"} : {guide.label}</Link></p>}
      </section>
      <section className={s.question} aria-label={questions.verification}>
        <h3>{questions.verification}</h3>
        <FindingGuide issue={issue} lang={lang} parts={["verification"]} showHeadings={false}/>
      </section>
    </div>
    <details className={s.evidence}>
      <summary className={s.evidenceSummary}><span>{questions.evidence}</span><span className={s.evidenceToggle} aria-hidden="true"/></summary>
      <div className={s.evidenceBody}>
        <p>{copy.source}: {source} · {t.report.priorityCards.confidenceLabel} {confidence}</p>
        <p>{content.qualification}</p>
        <section className={s.technical}>
          <h3>{questions.technical}</h3>
          <p>{copy.technicalTitle}: {cleanEvidence(issue.title)}</p>
          {issue.impact&&<p>{copy.originalObservation}: {cleanEvidence(issue.impact)}</p>}
          {issue.id&&<p>{copy.technicalId}: <code>{cleanEvidence(issue.id)}</code></p>}
          {issue.evidence&&evidence&&<p className={s.sourceObservation}>{cleanEvidence(issue.evidence)}</p>}
          <p>{copy.catalogueVersion}: {CATALOGUE_VERSION}</p>
          {!!evidence?.details?.length&&<dl className={s.rawFacts}>{evidence.details.map((detail,index)=>
            <div key={index}><dt><code>{detail.key==="score"&&issue.id?.startsWith("lighthouse.audit.")?copy.lighthouseRatio:cleanEvidence(detail.key)}</code></dt><dd>{cleanEvidence(detail.text)}</dd></div>)}</dl>}
        </section>
        <FindingGuide issue={issue} lang={lang} parts={["limits","detection","reference"]}/>
      </div>
    </details>
  </div>;
}
