"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useAccountSession } from "@/components/account/AccountSession";
import { accountFetch } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import { quotaToday, timelinePreset, usageTimelineQuery, type UsageGranularity, type UsageDimension, type UsageTimeline as Timeline } from "@/lib/usage-timeline";
import { DataTable } from "./Primitives";
import c from "./Connected.module.scss";
import s from "./UsageTimeline.module.scss";

export default function UsageTimeline({ timezone, refreshVersion = 0 }: { timezone: string; refreshVersion?: number }) {
  const { t, lang } = useLang(), copy = t.usageTimeline, { invalidate } = useAccountSession(), id = useId();
  const [granularity, setGranularity] = useState<UsageGranularity>("DAY");
  const [dimension, setDimension] = useState<UsageDimension>("GLOBAL");
  const [range, setRange] = useState(() => timelinePreset("DAY", 30, quotaToday(timezone)));
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: Timeline } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [preset, setPreset] = useState("30");
  const chartRef = useRef<HTMLDivElement>(null);
  const query = new URLSearchParams({ granularity, dimension, ...range });
  Object.keys(filters).forEach(key => query.append("filter", key));
  if (search) query.set("q", search);
  const key = query.toString(), valid = usageTimelineQuery(query) !== null;

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("argos-usage-refresh", refresh);
    return () => window.removeEventListener("argos-usage-refresh", refresh);
  }, []);
  useEffect(() => {
    if (!valid) return;
    let alive = true;
    const controller = new AbortController();
    void accountFetch<Timeline>("usage/timeline?" + key, "GET", undefined, controller.signal).then(data => {
      if (alive) { setResult({ key, data }); setFailure(null); }
    }).catch(reason => {
      if (alive) { invalidate(reason); setFailure(key); }
    });
    return () => { alive = false; controller.abort(); };
  }, [key, valid, revision, refreshVersion, invalidate]);

  const data = result?.key === key && failure !== key ? result.data : null;
  useEffect(() => {
    if (data && chartRef.current) chartRef.current.scrollLeft = chartRef.current.scrollWidth;
  }, [data]);
  const number = (value: number) => new Intl.NumberFormat(lang).format(value);
  const label = (series: Timeline["series"][number]) => series.key === "total" ? copy.GLOBAL : series.key === "other" ? copy.other : series.label ?? copy.unknown;
  const dateLabel = (value: string) => new Intl.DateTimeFormat(lang, { timeZone: "UTC", ...(granularity === "DAY" ? { day: "numeric", month: "short", year: "numeric" } : granularity === "MONTH" ? { month: "long", year: "numeric" } : { year: "numeric" }) }).format(new Date(value + "T00:00:00Z"));
  const coverageDate = data?.coverageFrom ? new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(data.coverageFrom)) : null;
  const incomplete = (bucket: Timeline["buckets"][number]) => !coverageDate || bucket.from <= coverageDate;
  const countLabel = (value: number, partial: boolean) => !value && partial ? "—" : number(value);
  const maximum = Math.max(1, ...data?.buckets.map(bucket => bucket.total) ?? []);
  const selected = data?.buckets.find(bucket => bucket.from === active) ?? data?.buckets.findLast(bucket => bucket.total > 0) ?? data?.buckets.at(-1);
  const tableSeries = data?.dimension === "GLOBAL" ? [] : data?.series ?? [];
  const options = new Map<string, { key: string; label: string | null; total: number | null }>();
  Object.entries(filters).forEach(([key, text]) => options.set(key, { key, label: text, total: null }));
  data?.options.forEach(option => options.set(option.key, option));
  const presets = granularity === "DAY" ? [[30, copy.days30], [90, copy.days90]] as const : granularity === "MONTH" ? [[12, copy.months12], [36, copy.months36]] as const : [[5, copy.years5], [10, copy.years10]] as const;
  const choosePreset = (unit: UsageGranularity, count: number) => { setRange(timelinePreset(unit, count, quotaToday(timezone))); setPreset(String(count)); setActive(null); };
  const retry = () => { setFailure(null); setResult(null); setRevision(value => value + 1); };

  return <section className={s.section} aria-labelledby={id + "-title"}>
    <div className={s.heading}><div><h2 id={id + "-title"}>{copy.title}</h2><p>{copy.intro}</p></div></div>
    <div className={s.controls}>
      <label>{copy.granularity}<select value={granularity} onChange={event => { const unit = event.target.value as UsageGranularity; setGranularity(unit); choosePreset(unit, unit === "DAY" ? 30 : unit === "MONTH" ? 12 : 5); }}>
        {(["DAY", "MONTH", "YEAR"] as const).map(unit => <option key={unit} value={unit}>{copy[unit]}</option>)}
      </select></label>
      <label>{copy.period}<select value={preset} onChange={event => choosePreset(granularity, Number(event.target.value))}>
        <option value="" disabled>{copy.period}</option>{presets.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select></label>
      <label>{copy.dimension}<select value={dimension} onChange={event => { setDimension(event.target.value as UsageDimension); setFilters({}); setSearch(""); }}>
        {(["GLOBAL", "DOMAIN", "URL"] as const).map(group => <option key={group} value={group}>{copy[group]}</option>)}
      </select></label>
    </div>
    <details className={s.dates}><summary>{dateLabel(range.from)} – {dateLabel(range.until)}</summary>
      <form className={s.controls} key={range.from + range.until} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); setRange({ from: String(form.get("from")), until: String(form.get("until")) }); setPreset(""); }}>
        <label>{copy.from}<input name="from" type="date" required defaultValue={range.from}/></label>
        <label>{copy.until}<input name="until" type="date" required defaultValue={range.until}/></label>
        <button className={c.secondary}>{copy.apply}</button>
      </form><p className={s.hint}>{copy.rangeHint}</p>
    </details>
    {dimension !== "GLOBAL" && <details className={s.filters}>
      <summary>{copy.filters}{Object.keys(filters).length > 0 && ` · ${Object.keys(filters).length} ${copy.selected}`}</summary>
      <p className={s.hint}>{copy.dimensionHint}</p>
      <form className={s.controls} key={dimension + search} onSubmit={event => { event.preventDefault(); setSearch(String(new FormData(event.currentTarget).get("q")).trim()); }}>
        <label className={s.search}>{copy.search}<input type="search" name="q" maxLength={200} defaultValue={search}/></label><button className={c.secondary}>{copy.searchAction}</button>
        <button className={c.secondary} type="button" onClick={() => { setFilters({}); setSearch(""); }}>{copy.clear}</button>
      </form>
      <fieldset className={s.options}><legend>{copy.filterHint}</legend>
        {Array.from(options.values()).map(option => <label key={option.key}>
          <input type="checkbox" checked={option.key in filters} disabled={!(option.key in filters) && Object.keys(filters).length >= 20} onChange={event => setFilters(previous => { const next = { ...previous }; if (event.target.checked) next[option.key] = option.label ?? copy.unknown; else delete next[option.key]; return next; })}/>
          <span>{option.label ?? copy.unknown}</span>{option.total !== null && <strong>{number(option.total)}</strong>}
        </label>)}
      </fieldset>{data?.moreOptions && <p className={s.hint}>{copy.more}</p>}
    </details>}
    {!valid ? <p className={s.message} role="alert">{copy.invalid}</p> : failure === key ? <div className={s.message}><p role="alert">{copy.error}</p><button className={c.secondary} onClick={retry}>{copy.retry}</button></div> : !data ? <p className={s.message} role="status">{copy.loading}</p> : <>
      <div className={s.summary}><p><strong>{number(data.total)}</strong> {copy.total}<span> · {Object.keys(filters).length ? copy.selection : copy.all}</span></p><p className={s.hint}>{copy.timezone} · {data.timezone}</p></div>
      <div className={s.coverage}>
        <p>{data.coverageFrom ? <>{copy.coverage} <time dateTime={data.coverageFrom}>{new Date(data.coverageFrom).toLocaleDateString(lang, { timeZone: data.timezone, dateStyle: "medium" })}</time>. {copy.coverageHint}</> : copy.coverageUnknown}</p>
        {data.undatedCredits > 0 && <p>{number(data.undatedCredits)} {copy.undated}</p>}
      </div>
      {data.total === 0 && <div className={s.empty}><h3>{copy.empty}</h3><p>{copy.emptyHint}</p></div>}
      {data.total > 0 && <>
        <ul className={s.legend}>{data.series.map((series, index) => <li key={series.key}><span className={s.swatch} style={{ "--series-index": index } as CSSProperties} aria-hidden="true"/><span>{label(series)}</span><strong>{number(series.total)}</strong></li>)}</ul>
        <p className={s.hint}>{copy.maximum} · {number(maximum)}</p>
        <div className={s.chartScroll} ref={chartRef} role="region" tabIndex={0} aria-label={copy.chart}>
          <div className={s.chart} style={{ "--bucket-count": data.buckets.length } as CSSProperties}>
            {data.buckets.map((bucket, index) => <button type="button" key={bucket.from} className={s.column} aria-label={`${copy.selectPeriod} · ${dateLabel(bucket.from)} · ${countLabel(bucket.total, incomplete(bucket))} ${copy.credits}${incomplete(bucket) ? " · " + copy.partial : ""}`} aria-pressed={selected?.from === bucket.from} onFocus={() => setActive(bucket.from)} onMouseEnter={() => setActive(bucket.from)} onClick={() => setActive(bucket.from)}>
              <span className={s.stack} aria-hidden="true">{data.series.map((series, seriesIndex) => <span key={series.key} className={s.segment} style={{ height: `${(bucket.values[series.key] ?? 0) / maximum * 100}%`, "--series-index": seriesIndex } as CSSProperties}/>)}</span>
              <span className={s.tick} aria-hidden="true">{index === 0 || index === data.buckets.length - 1 || index % (granularity === "DAY" ? 5 : granularity === "MONTH" && data.buckets.length > 24 ? 3 : 1) === 0 ? new Intl.DateTimeFormat(lang, { timeZone: "UTC", ...(granularity === "DAY" ? { day: "numeric", month: "short" } : granularity === "MONTH" ? { month: "short", year: "2-digit" } : { year: "numeric" }) }).format(new Date(bucket.from)) : ""}</span>
            </button>)}
          </div>
        </div>
        {selected && <div className={s.detail} role="status" aria-label={copy.point}><strong>{dateLabel(selected.from)} · {countLabel(selected.total, incomplete(selected))} {copy.credits}</strong><ul>{data.series.map(series => <li key={series.key}>{label(series)} <strong>{countLabel(selected.values[series.key] ?? 0, incomplete(selected))}</strong></li>)}</ul>{incomplete(selected) && <p className={s.hint}>{copy.partial}</p>}</div>}
      </>}
      <details className={s.table}><summary>{copy.table}</summary>
        <DataTable caption={copy.title + " · " + copy.credits} columns={[copy.date, ...tableSeries.map(label), copy.GLOBAL]}>
          {data.buckets.map(bucket => <tr key={bucket.from}><th scope="row">{dateLabel(bucket.from)}{incomplete(bucket) && <span className={s.partial}>{copy.partial}</span>}</th>{tableSeries.map(series => <td key={series.key}>{countLabel(bucket.values[series.key] ?? 0, incomplete(bucket))}</td>)}<td>{countLabel(bucket.total, incomplete(bucket))}</td></tr>)}
        </DataTable>
      </details>
    </>}
  </section>;
}
