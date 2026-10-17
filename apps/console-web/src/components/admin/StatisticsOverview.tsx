"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocalizedLink";
import { useAccountSession } from "@/components/account/AccountSession";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import AdminNavigation from "./AdminNavigation";
import StatisticsNavigation from "./StatisticsNavigation";
import { statisticsCopy } from "./statisticsCopy";
import s from "./StatisticsOverview.module.scss";

type Count = number | null;
export type Statistics = {
  generatedAt: string; from: string | null; period: string;
  accounts: { created: Count; validated: Count; suspended: Count; archived: Count; validationUnknown: Count; google: Count; github: Count; linkedin: Count };
  analyses: { total: Count; queued: Count; running: Count; completed: Count; failed: Count; canceled: Count; unknown: Count };
  domains: { total: Count; averageUrls: Count };
};

export default function StatisticsOverview() {
  const { lang } = useLang(), c = statisticsCopy[lang], session = useAccountSession();
  const [period, setPeriod] = useState("all"), [revision, setRevision] = useState(0), [denied, setDenied] = useState(false);
  const [result, setResult] = useState<{ key: string; data: Statistics | null; error: boolean } | null>(null);
  const allowed = session.ready && !session.denied && session.profile?.verified && session.profile.admin && !denied;
  const key = period + ":" + revision;
  const current = allowed && result?.key === key ? result : null, data = current?.data;
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    void accountFetch<Statistics>("admin/statistics?period=" + period, "GET", undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult({ key, data, error: false }); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof AccountClientError && [401, 403].includes(error.status)) setDenied(true);
        setResult({ key, data: null, error: true });
      });
    return () => controller.abort();
  }, [allowed, key, period]);

  const number = (value: Count | undefined, fraction = false) => value == null || !Number.isFinite(value)
    ? "—" : new Intl.NumberFormat(lang, { maximumFractionDigits: fraction ? 2 : 0 }).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
  const metric = (label: string, value: Count | undefined, fraction = false) => <div key={label}>
    <dt>{label}</dt><dd aria-label={value == null ? c.unavailable : undefined}>{number(value, fraction)}</dd>
  </div>;
  const statuses = ["completed", "failed", "running", "queued", "canceled", "unknown"] as const;

  return <main className={s.main}>
    <header><p className={s.eyebrow}>Administration</p><h1>{c.title}</h1><p>{c.intro}</p></header>
    {!session.ready ? <p role="status">{c.loading}</p> : !allowed ? <p role="alert">{c.denied}</p> : <>
      <AdminNavigation active="analytics" />
      <StatisticsNavigation active="overview" />
      <div className={s.controls}>
        <label htmlFor="statistics-period">{c.period}<select id="statistics-period" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">{c.all}</option>{["7", "30", "90"].map(value => <option key={value} value={value}>{value} {c.days}</option>)}
        </select></label>
        <button type="button" disabled={!current} onClick={() => setRevision(value => value + 1)}>{c.refresh}</button>
      </div>
      <p className={s.definition}>{c.cohort}</p>
      {current?.error ? <p role="alert">{c.error}</p> : !data ? <p role="status">{c.loading}</p> : <>
        <p className={s.timestamp}>{c.updated} <time dateTime={data.generatedAt}>{date(data.generatedAt)} UTC</time>
          {data.from && <> · {c.range} <time dateTime={data.from}>{date(data.from)} UTC</time></>}</p>
        {data.accounts.created === 0 && data.analyses.total === 0 && <p role="status">{c.empty}</p>}
        <section className={s.section} aria-labelledby="statistics-accounts">
          <div className={s.sectionHeading}><h2 id="statistics-accounts">{c.accounts}</h2><Link href="/account/admin/users">{c.users}</Link></div>
          <dl className={s.metrics}>
            {metric(c.created, data.accounts.created)}{metric(c.validated, data.accounts.validated)}
            {metric(c.suspended, data.accounts.suspended)}{metric(c.archived, data.accounts.archived)}
          </dl>
          <p>{c.validationHelp} {c.validationUnknown} : <strong>{number(data.accounts.validationUnknown)}</strong>.</p><p>{c.overlap}</p>
          <h3>{c.providers}</h3><dl className={s.providers}>
            {metric("Google", data.accounts.google)}{metric("GitHub", data.accounts.github)}{metric("LinkedIn", data.accounts.linkedin)}
          </dl><p>{c.providersHelp}</p>
        </section>
        <section className={s.section} aria-labelledby="statistics-analyses">
          <div className={s.sectionHeading}><h2 id="statistics-analyses">{c.analyses}</h2><Link href="/account/admin/runs">{c.runs}</Link></div>
          <dl className={s.metrics}>{metric(c.totalUrls, data.analyses.total)}</dl>
          <dl className={s.statuses}>{statuses.map(status => <div key={status} data-status={status}>
            <dt><span className={s.dot} aria-hidden="true" />{c[status]}</dt><dd>{number(data.analyses[status])}</dd>
          </div>)}</dl>
          <p>{c.statusHelp}</p><details><summary>{lang === "fr" ? "Comment les URL sont comptées" : "How URLs are counted"}</summary><p>{c.urlsHelp}</p></details>
        </section>
        <section className={s.section} aria-labelledby="statistics-domains">
          <h2 id="statistics-domains">{c.domains}</h2><dl className={s.metrics}>
            {metric(c.totalDomains, data.domains.total)}{metric(c.average, data.domains.averageUrls, true)}
          </dl><p>{c.domainsHelp}</p>
        </section>
        <div className={s.notes}><p>{c.scope}</p><p>{c.history}</p><p>{c.listHelp}</p></div>
      </>}
    </>}
  </main>;
}
