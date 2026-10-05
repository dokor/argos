"use client";
import type { Coverage } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./MeasurementCoverage.module.scss";

export default function MeasurementCoverage({ coverage }: { coverage?: Coverage | null }) {
  const { t } = useLang(); const tc = t.report.measurementCoverage;
  if (!coverage) return null;
  const percent = (ratio: number) => `${Math.round(ratio * 100)} %`;
  const states = ["MEASURED", "UNAVAILABLE", "BLOCKED_BY_ANTIBOT", "NOT_APPLICABLE"] as const;
  return <aside className={s.panel} aria-label={tc.title}>
    <h2>{tc.title}</h2>
    <p>{coverage.global.available ? `${percent(coverage.global.ratio)} — ${coverage.provisional ? tc.provisional : tc.sufficient}` : tc.unavailable}</p>
    <p>{tc.explanation}</p>
    <ul className={s.domains}>{coverage.domains.map(domain => <li key={domain.key}>
      <strong>{(tc.domains as Record<string, string>)[domain.key] ?? domain.key}</strong>: {domain.expectedWeight === 0 ? tc.notApplicable : domain.available ? `${percent(domain.ratio)}${domain.sufficient ? "" : ` — ${tc.provisional}`}` : tc.unavailable}
    </li>)}</ul>
    <details><summary>{tc.statesTitle}</summary>
      <ul>{states.map(state => <li key={state}>{tc.states[state]}: {coverage.checks.filter(check => check.state === state).length}</li>)}</ul>
      <p>{tc.confidenceExplanation}</p>
    </details>
  </aside>;
}
