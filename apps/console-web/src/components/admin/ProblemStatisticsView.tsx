"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocalizedLink";
import { useAccountSession } from "@/components/account/AccountSession";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import { findingTitle } from "@/components/report/findingCatalogue";
import AdminNavigation from "./AdminNavigation";
import StatisticsNavigation from "./StatisticsNavigation";
import { problemStatisticsCopy } from "./problemStatisticsCopy";
import s from "./ProblemStatisticsView.module.scss";

type Category = "performance" | "security" | "seo" | "a11y";
export type ProblemStatistics = {
  from: string; until: string; generatedAt: string; scoringVersion: number; scoringFingerprint: string;
  coverageVersion: string; minimumGroupSize: number; reports: number; domains: number;
  retainedDomains: number; partialDomains: number; excludedDomains: number; pendingDomains: number;
  findings: { key: string; category: Category; severity: "critical" | "important" | "info";
    affectedDomains: number; measuredDomains: number; frequency: number }[];
};

export default function ProblemStatisticsView() {
  const { lang } = useLang(), c = problemStatisticsCopy[lang], session = useAccountSession();
  const [days, setDays] = useState(90), [category, setCategory] = useState(""), [revision, setRevision] = useState(0);
  const [denied, setDenied] = useState(false);
  const [result, setResult] = useState<{ request: string; data: ProblemStatistics | null; error: boolean } | null>(null);
  const allowed = session.ready && !session.denied && session.profile?.verified && session.profile.admin && !denied;
  const request = `${days}:${category}:${revision}`, current = allowed && result?.request === request ? result : null;
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ days: String(days), ...(category ? { category } : {}) });
    void accountFetch<ProblemStatistics>("admin/problem-statistics?" + query, "GET", undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult({ request, data, error: false }); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof AccountClientError && [401, 403].includes(error.status)) setDenied(true);
        setResult({ request, data: null, error: true });
      });
    return () => controller.abort();
  }, [allowed, days, category, request]);
  const data = current?.data;
  const number = (value: number) => new Intl.NumberFormat(lang).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  const percent = (value: number) => new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 }).format(value);

  return <main className={s.main}>
    <Link className={s.back} href="/account/admin">{c.back}</Link>
    {allowed && <><AdminNavigation active="analytics" /><StatisticsNavigation active="problems" /></>}
    <header className={s.header}><p className={s.eyebrow}>{c.eyebrow}</p><h1>{c.title}</h1><p>{c.intro}</p></header>
    {!session.ready ? <p role="status">{c.loading}</p> : !allowed ? <><p role="alert">{c.denied}</p><Link href="/account/sign-in">{c.signIn}</Link></> : <>
      <div className={s.filters}>
        <label>{c.period}<select value={days} onChange={event => setDays(Number(event.target.value))}>
          {[90, 30].map(value => <option key={value} value={value}>{value} {c.days}</option>)}
        </select></label>
        <label>{c.category}<select value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">{c.all}</option>{Object.entries(c.categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <div className={s.method}>{c.method}{data ? ` · v${data.scoringVersion}` : ""}<span>{c.utc}</span></div>
        <button type="button" onClick={() => setRevision(value => value + 1)}>{c.refresh}</button>
      </div>
      {current?.error ? <p role="alert">{c.error}</p> : !data ? <p role="status">{c.loading}</p> : <>
        <p className={s.period}>{date(data.from)} → {date(new Date(Date.parse(data.until) - 86400000).toISOString())} · UTC</p>
        <dl className={s.metrics}>
          <div><dt>{c.retained}</dt><dd>{number(data.retainedDomains)}</dd></div>
          <div><dt>{c.reports}</dt><dd>{number(data.reports)}</dd></div>
          <div><dt>{c.partial}</dt><dd>{number(data.partialDomains)} <small>/ {number(data.retainedDomains)}</small></dd></div>
        </dl>
        {data.pendingDomains > 0 && <p className={s.notice} role="status">{number(data.pendingDomains)} {c.pending}</p>}
        <section aria-labelledby="problem-ranking-title">
          <div className={s.sectionHeading}><h2 id="problem-ranking-title">{c.findings}</h2><p>{c.order}</p></div>
          {!data.reports ? <p role="status">{c.noReports}</p> : !data.findings.length ? <p role="status">{c.empty}</p> : <ol className={s.ranking}>
            {data.findings.map((finding, index) => <li className={s.row} key={finding.key}>
              <span className={s.rank} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div className={s.finding}><h3>{findingTitle(finding.key, lang)}</h3>
                <p>{c.categories[finding.category]} · {c.severity[finding.severity]}</p><code>{finding.key}</code></div>
              <div className={s.frequency}>
                <div className={s.values}><strong>{percent(finding.frequency)}</strong>
                  <span><span className={s.srOnly}>{c.affected} </span>{number(finding.affectedDomains)} / {number(finding.measuredDomains)} {c.measured}</span></div>
                <div className={s.track} aria-hidden="true"><span style={{ width: `${finding.frequency * 100}%` }} /></div>
              </div>
            </li>)}
          </ol>}
        </section>
        <details className={s.details}><summary>{c.methodology}</summary><div>
          <p>{number(data.domains)} {c.audited} · {number(data.excludedDomains)} {c.excluded}.</p>
          <p>{c.rule}</p><p>{c.denominator}</p>
          <p>{c.threshold.replaceAll("{n}", number(data.minimumGroupSize))}</p><p>{c.limits}</p><p>{c.retention}</p>
          <dl className={s.metadata}><div><dt>{c.fingerprint}</dt><dd><code>{data.scoringFingerprint}</code></dd></div>
            <div><dt>{c.coverage}</dt><dd>{data.coverageVersion}</dd></div><div><dt>{c.generated}</dt><dd>{date(data.generatedAt)} · UTC</dd></div></dl>
        </div></details>
      </>}
    </>}
  </main>;
}
