import type { Coverage } from './types';
import type { Lang } from '@/lib/i18n/routes';
import { coverageAction, coverageBreakdown, coverageCopy } from './coverageExplanation';
import { findingTitle } from './findingCatalogue';
import { collectorReason } from '@/lib/collector-reason';
import s from './CoverageDetails.module.scss';

// Do not print arbitrary server diagnostics or private URLs as codes.
const safeCode = (value?: string | null) => value && /^[a-zA-Z0-9_.-]{1,100}$/.test(value) ? value : '—';
export default function CoverageDetails({ coverage, lang }: { coverage?: Coverage | null; lang: Lang }) {
  const c = coverageCopy[lang];
  const reasonText = (reason: string) => Object.hasOwn(c.reasons, reason) ? c.reasons[reason] : collectorReason(reason, lang);
  if (!coverage?.global || !Array.isArray(coverage.checks)) return <p>{c.unavailable}</p>;
  const { missing, excluded, partial, points, reconciled } = coverageBreakdown(coverage);
  const format = (value: number) => value.toLocaleString(lang, { maximumFractionDigits: 2 });
  const ratio = coverage.global.ratio;
  return <section className={s.details} aria-label={c.title}>
    <h3>{c.title}</h3>
    {Number.isFinite(ratio) && <p><strong>{Math.round(ratio * 100)} % {c.measured} — {Math.round((1 - ratio) * 100)} % {c.missing}</strong></p>}
    <p>{format(coverage.global.measuredWeight)} / {format(coverage.global.expectedWeight)} · {safeCode(coverage.version)}</p>
    {Number.isFinite(coverage.threshold) && <p>{c.threshold}: {Math.round(coverage.threshold * 100)} %</p>}
    <p>{c.historical}</p>
    {!reconciled && <p>{c.mismatch}</p>}
    {!coverage.checks.length ? <p>{c.unavailable}</p> : !missing.length && !partial.length && reconciled && <p>{c.empty}</p>}
    <ul>{[...missing, ...partial].map(check => <li key={check.key}>
      <p><strong>{findingTitle(check.key, lang)}</strong> · <code>{safeCode(check.key)}</code></p>
      <p>{check.state === 'MEASURED' ? c.partial : `${format(points(check.weight) ?? 0)} ${c.points}`} · {c.weight}: {format(check.weight)}</p>
      <p>{c.owner}: {safeCode(check.module)} · {c.source}: {check.measurementModule ? safeCode(check.measurementModule) : c.unknown}
        {check.measurementSources?.length ? ` (${check.measurementSources.map(value => safeCode(value)).join(', ')})` : ''}</p>
      <p>{reasonText(check.reason) ?? c.unavailable} <code>{reasonText(check.reason) ? safeCode(check.reason) : 'UNKNOWN_REASON'}</code> · {safeCode(check.confidence)}</p>
      <p>{coverageAction(check.state, check.reason, lang)}</p>
    </li>)}</ul>
    {!!excluded.length && <details><summary>{c.excluded} ({excluded.length})</summary><ul>{excluded.map(check => <li key={check.key}>
      <code>{safeCode(check.key)}</code> · {c.weight}: {format(check.weight)} · {reasonText(check.reason) ?? c.unavailable} <code>{reasonText(check.reason) ? safeCode(check.reason) : 'UNKNOWN_REASON'}</code>
    </li>)}</ul></details>}
  </section>;
}
