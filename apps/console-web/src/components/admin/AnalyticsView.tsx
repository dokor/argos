"use client";

import AdminNavigation from "./AdminNavigation";
import StatisticsNavigation from "./StatisticsNavigation";
import MeasurementControl from "./MeasurementControl";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/LocalizedLink";
import { useAccountSession } from "@/components/account/AccountSession";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import { analyticsCopy } from "./analyticsCopy";
import s from "./AnalyticsView.module.scss";

type Counts = Record<"accepted" | "started" | "completed" | "failed" | "pending" | "viewed" | "completedViewed", number>;
type Delay = { sample: number; excluded: number; medianMs: number | null; p90Ms: number | null; p95Ms: number | null };
export type ProductMetrics = {
  enabled: boolean; capped: boolean; from: string; until: string; cohort: Counts;
  bySource: { route: string; lang: string; placement: string; counts: Counts }[];
  queue: Delay; processing: Delay; endToEnd: Delay;
  events: { event: string; route: string; lang: string; placement: string; error: string; count: number }[];
};

export default function AnalyticsView() {
  const { lang } = useLang(), c = analyticsCopy[lang], session = useAccountSession();
  const [days, setDays] = useState(30), [revision, setRevision] = useState(0);
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);
  const onChanged = useCallback(() => setRevision(value => value + 1), []);
  const [result, setResult] = useState<{ request: string; data: ProductMetrics | null; error: boolean } | null>(null);
  const allowed = session.ready && !session.denied && session.profile?.verified && session.profile.admin && !denied;
  const request = days + ":" + revision;
  const current = allowed && result?.request === request ? result : null;
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    void accountFetch<ProductMetrics>("admin/analytics?days=" + days, "GET", undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult({ request, data, error: false }); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof AccountClientError && [401, 403].includes(error.status)) setDenied(true);
        setResult({ request, data: null, error: true });
      });
    return () => controller.abort();
  }, [allowed, days, request]);
  const seconds = (value: number | null) => value === null ? c.unavailable : new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 1000) + " s";
  const data = current?.data;

  return <><main className={s.main}>
    <Link href="/account/admin">{c.back}</Link><h1>{c.title}</h1><p>{c.intro}</p>
    {!session.ready ? <p role="status">{c.loading}</p> : !allowed ? <><p role="alert">{c.denied}</p><Link href="/account/sign-in">{c.signIn}</Link></> : <>
      <AdminNavigation active="analytics" />
      <StatisticsNavigation active="product" />
      <MeasurementControl onDenied={onDenied} onChanged={onChanged} />
      <div className={s.controls}><label htmlFor="analytics-period">{c.period}</label>
        <select id="analytics-period" value={days} onChange={event => setDays(Number(event.target.value))}>
          {[7, 30, 90].map(value => <option key={value} value={value}>{value} {c.days}</option>)}
        </select><button type="button" onClick={() => setRevision(value => value + 1)}>{c.refresh}</button>
      </div>
      {current?.error ? <p role="alert">{c.error}</p> : !data ? <p role="status">{c.loading}</p> : <>
        <p>{c.collection} {data.enabled ? c.enabled : c.disabled} · {data.from} → {data.until}</p>
        {data.capped && <p role="status">{c.cap}</p>}
        <h2>{c.cohort}</h2><dl>{Object.entries(c.counts).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data.cohort[key as keyof Counts]}</dd></div>)}</dl>
        <p>{c.dedup}</p><h2>{c.delays}</h2>
        <div className={s.scroll} tabIndex={0} role="region" aria-label={c.table}><table><thead><tr>
          {[c.measure, c.sample, c.excluded, c.median, "p90", "p95"].map(label => <th key={label} scope="col">{label}</th>)}
        </tr></thead><tbody>{([[c.queue, data.queue], [c.processing, data.processing], [c.total, data.endToEnd]] as const).map(([label, delay]) => <tr key={label}>
          <th scope="row">{label}</th><td>{delay.sample}</td><td>{delay.excluded}</td><td>{seconds(delay.medianMs)}</td><td>{seconds(delay.p90Ms)}</td><td>{seconds(delay.p95Ms)}</td>
        </tr>)}</tbody></table></div><p>{c.delayHelp}</p>
        <h2>{c.sources}</h2>{!data.bySource.length ? <p>{c.emptySources}</p> : <div className={s.scroll} tabIndex={0} role="region" aria-label={c.sources}><table><thead><tr>
          {[c.source, c.counts.accepted, c.counts.completed, c.counts.failed, c.counts.viewed].map(label => <th key={label} scope="col">{label}</th>)}
        </tr></thead><tbody>{data.bySource.map(row => <tr key={[row.route, row.lang, row.placement].join(":")}>
          <th scope="row">{row.route} · {row.lang} · {row.placement}</th><td>{row.counts.accepted}</td><td>{row.counts.completed}</td><td>{row.counts.failed}</td><td>{row.counts.viewed}</td>
        </tr>)}</tbody></table></div>}
        <h2>{c.events}</h2><p>{c.eventHelp}</p>{!data.events.length ? <p>{c.emptyEvents}</p> : <ul>{data.events.map((row, index) => <li key={index}>{row.event} · {row.route} · {row.lang} · {row.placement} · {row.error} : {row.count}</li>)}</ul>}
      </>}
    </>}
  </main></>;
}
