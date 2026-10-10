import s from './PrintableReport.module.scss';
import type { Report } from './types';
import type { Lang } from '@/lib/i18n/routes';
import { buildReportModel } from './reportModel';
import { findingContent, cleanEvidence, CATALOGUE_VERSION } from './findingCatalogue';
import { globalScore, domainScore, partialReport, reportScope } from './reportSummaryModel';
import { decisionCopy } from './decisionCopy';
import { reportReadingCopy } from './reportReadingCopy';
import { exportCopy } from './exportCopy';
import fr from '@/lib/i18n/fr.json';
import en from '@/lib/i18n/en.json';
export type ExportFormat = 'summary'|'full';
export default function PrintableReport({report,lang,format}:{report:Report;lang:Lang;format:ExportFormat}) {
 const model=buildReportModel(report); const d=decisionCopy[lang];const r=reportReadingCopy[lang]; const e=exportCopy[lang];const t=(lang==='fr'?fr:en).report;
 const score=globalScore(report); const verdict=model.counts.critical?'critical':score===undefined?'unavailable':model.counts.important?'important':model.counts.opportunity?'opportunity':'empty';
 const facts=Object.entries(model.counts).reduce((text,[key,value])=>text.replace('{'+key+'}',String(value)),r.summaryFacts as string);
 const date=new Date(report.generatedAt); const coverage=report.scores.coverage;
 const pct=(value:number|undefined)=>typeof value==='number'&&Number.isFinite(value)?Math.round(value*100)+' %':e.unknown;
 const title=(key:string)=>Object.hasOwn(t.priorityCards.domains,key)?(t.priorityCards.domains as Record<string,string>)[key]:t.issuesByCategory.unknownDomain;
 const priorities=model.priorities.slice(0,format==='full'?6:3);
 const method=(process.env.NEXT_PUBLIC_SITE_URL||'https://argos.lelouet.fr')+(lang==='fr'?'/methodologie-score':'/en/scoring-method');
 return <main lang={lang} className={s.document}><header><p>ARGOS · {format==='full'?e.full:e.summary}</p><h1>{cleanEvidence(report.domain)}</h1>
 <p>{d.scope}: {reportScope(report.url)??d.scopeUnknown}</p><p>{t.hero.analyzedAt}: {Number.isFinite(date.getTime())?date.toLocaleString(lang,{timeZone:'UTC',timeZoneName:'short'}):d.dateUnknown}</p>
 <p>{e.private}</p></header><section><h2>{d.verdict[verdict]}</h2><p>{facts}</p>
 <p><strong>{r.score}: {score===undefined?d.notEvaluated:score+'/100'}</strong> · {partialReport(report)?d.provisional:d.measured}</p>
 {score!==undefined&&score>=70&&model.counts.critical>0&&<p>{d.favourable}</p>}
 {!model.counts.total&&<p>{d.empty}</p>}{partialReport(report)&&<p>{report.antiBot?.detected?d.antiBot:r.partial}</p>}
 <p>{r.coverage}: {coverage?pct(coverage.global.ratio):d.coverageUnknown}</p><p>{d.coverageExplain}</p>
 <p>{r.moduleCompleteness}: {typeof report.scores.completeness==='number'?report.scores.completeness+' %':e.unknown}</p><p>{d.completenessExplain}</p>
 <table><caption>{r.score} / {e.coverage}</caption><thead><tr><th>{r.domain}</th><th>{r.score}</th><th>{e.coverage}</th></tr></thead><tbody>{model.groups.filter(g=>g.key!=='unknown').map(g=>{const value=domainScore(g.score?.score,g.key,coverage);return <tr key={g.key}><th scope="row">{title(g.key)}</th><td>{value===undefined?d.notEvaluated:value+'/100'}</td><td>{pct(coverage?.domains.find(row=>row.key===g.key)?.ratio)}</td></tr>;})}</tbody></table>
 <p>{d.automaticLimit}</p><p>{r.limits}</p></section>
 <section><h2>{r.actions}</h2>{!priorities.length&&<p>{t.priorityCards.empty}</p>}{priorities.map((resolved,index)=>{const p=resolved.priority;const grouped=new Set([p.findingKey,...(p.relatedFindingKeys??[])].filter(Boolean)).size>1;const content=!grouped&&resolved.findings.length===1?findingContent(resolved.findings[0].issue,lang):undefined;return <article key={index}>
 <h3>{t.priorityCards.rankLabel} {p.rank??index+1} · {content?.recommendation??cleanEvidence(p.title)}</h3><p>{content?.impact??cleanEvidence(p.impact)}</p>
 <p>{title(p.categoryKey??resolved.findings[0]?.domain??'unknown')} · {t.priorityCards.effortLabel} {p.effort??t.priorityCards.effortUnknown}</p>
 <p>{t.priorityCards.confidenceLabel} {p.confidence&&Object.hasOwn(t.priorityCards.confidence,p.confidence)?t.priorityCards.confidence[p.confidence]:t.priorityCards.confidence.UNKNOWN}</p>
 <p>{e.source}: {[...new Set([...(p.sources??[]),...resolved.findings.flatMap(f=>f.sources)])].map(cleanEvidence).join(', ')||e.unknown}</p>
 {p.rankReason&&<p>{t.priorityCards.rankReasons[p.rankReason]}</p>}{p.rankReason==='MODELLED_SCORE_GAIN'&&typeof p.globalScoreGain==='number'&&Number.isFinite(p.globalScoreGain)&&<p>{t.priorityCards.gainLabel} {p.globalScoreGain.toLocaleString(lang,{maximumFractionDigits:2})} {t.priorityCards.gainUnit}. {t.priorityCards.modelLimit}</p>}
 {grouped&&<p>{t.priorityCards.groupedLabel} {resolved.findings.length}</p>}
 {resolved.findings.map(f=><p key={f.key}>{t.priorityCards.seeFinding}: {cleanEvidence(f.issue.title)} ({cleanEvidence(f.key)})</p>)}
 {resolved.status!=='resolved'&&<p>{resolved.status==='partial'?t.priorityCards.partialFindings:t.priorityCards.missingFinding}</p>}<p>{t.priorityCards.confirmNext}</p></article>;})}</section>
 {format==='full'&&<section><h2>{r.technical}</h2>{model.groups.filter(g=>g.findings.length).map(g=><section key={g.key}><h3>{title(g.key)}</h3>{g.findings.map(f=>{const i=f.issue;const c=findingContent(i,lang);const m=i.structuredEvidence?.measurement;const valid=m&&Number.isFinite(m.value)&&Object.hasOwn(r.units,m.unit);return <article key={f.key} id={f.anchor}>
 <h4>{c.title}</h4><p>{t.issuesByCategory.severity[i.severity]}</p><p><strong>{r.impact}:</strong> {c.impact}</p><p><strong>{r.observation}:</strong> {c.observation}</p>
 <p>{r.technicalTitle}: {cleanEvidence(i.title)}</p><p>{r.originalObservation}: {cleanEvidence(i.impact)}</p><p>{r.technicalId}: {cleanEvidence(i.id??f.key)}</p>
 <p>{r.source}: {cleanEvidence(i.structuredEvidence?.source||f.sources.join(', '))||d.sourcesUnknown}</p><p>{t.priorityCards.confidenceLabel} {i.confidence&&Object.hasOwn(t.priorityCards.confidence,i.confidence)?t.priorityCards.confidence[i.confidence]:r.unknownConfidence}</p>
 <h5>{r.evidence}</h5>{valid?<p>{i.id==='runtime.network.bytes_estimated'?r.estimated+': ':''}{m.value.toLocaleString(lang,{maximumSignificantDigits:6})} {r.units[m.unit]}</p>:<p>{r.missingMeasure}</p>}
 {i.structuredEvidence?.details?.length?<dl>{i.structuredEvidence.details.slice(0,20).map((detail,n)=><div key={n}><dt>{detail.key==='score'&&i.id?.startsWith('lighthouse.audit.')?r.lighthouseRatio:cleanEvidence(detail.key)}</dt><dd>{cleanEvidence(detail.text)}</dd></div>)}</dl>:i.evidence&&<p className="evidence">{cleanEvidence(i.evidence)}</p>}
 <p><strong>{r.recommendation}:</strong> {c.recommendation}</p><p><strong>{r.verification}:</strong> {c.verification}</p></article>;})}</section>)}</section>}
 <section><h2>{d.method}</h2><p>{d.confidenceExplain}</p><p>{d.lighthouse}</p><p>{d.automaticLimit}</p><p>{r.limits}</p>
 <p>{d.scoring}: {report.scores.calculation?.scoringVersion??d.versionsUnknown}</p><p>{d.coverageVersion}: {coverage?.version??e.unknown}</p><p>{d.editorial}: {CATALOGUE_VERSION}</p>
 {coverage&&<ul>{(['MEASURED','UNAVAILABLE','BLOCKED_BY_ANTIBOT','NOT_APPLICABLE'] as const).map(state=><li key={state}>{t.measurementCoverage.states[state]}: {coverage.checks.filter(c=>c.state===state).length}</li>)}</ul>}
 <p>{d.missingModules}: {[...new Set(coverage?.checks.filter(c=>c.state==='UNAVAILABLE'||c.state==='BLOCKED_BY_ANTIBOT').map(c=>c.module)??[])].join(', ')||e.unknown}</p>
 <p>{d.source}: {[...new Set(model.findings.flatMap(f=>[...f.sources,f.issue.structuredEvidence?.source]).filter(Boolean))].map(v=>cleanEvidence(v!)).join(', ')||d.sourcesUnknown}</p>
 <p>{r.next}</p><a href={method}>{d.generalMethod}</a></section></main>;
}
