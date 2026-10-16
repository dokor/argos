"use client";
import AdminNavigation from "@/components/admin/AdminNavigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { feedbackStatuses, feedbackTypes } from "@/lib/feedback-request";
import { useAccountSession } from "@/components/account/AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import Link from "@/components/LocalizedLink";
import { feedbackCopy } from "./copy";
import s from "./FeedbackForm.module.scss";

type Row = { id: string; type: typeof feedbackTypes[number]; status: typeof feedbackStatuses[number]; createdAt: string; updatedAt: string };
type Detail = Row & { description: string; urls?: string | null; page: string | null; expected: string | null; observed: string | null; steps: string | null; runId: string | null; findingKey: string | null; events: { actorId: string; oldStatus: Row["status"]; newStatus: Row["status"]; createdAt: string }[] };
type Page = { items: Row[]; nextCursor: string | null };
type Copy = typeof feedbackCopy.fr;
function errorMessage(error: unknown, c: Copy) {
  return error instanceof AccountClientError ? error.status === 409 ? c.conflict : [401, 403].includes(error.status) ? c.denied : error.status === 400 ? c.invalid : error.status === 404 ? c.unavailable : c.error : c.error;
}
function usePrivateResource<T>(path: string | null, denied: () => void) {
  const [result, setResult] = useState<{ path: string; value?: T; error?: unknown } | null>(null), [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true; const controller = new AbortController();
    queueMicrotask(() => { if (alive) setResult(null); });
    void accountFetch<T>(path, "GET", undefined, controller.signal).then(value => { if (alive) setResult({ path, value }); }).catch(error => {
      if (!alive) return;
      if (error instanceof AccountClientError && [401, 403].includes(error.status)) denied();
      setResult({ path, error });
    });
    return () => { alive = false; controller.abort(); };
  }, [path, version, denied]);
  return { data: result?.path === path ? result.value : undefined, error: result?.path === path ? result.error : undefined, loading: !!path && result?.path !== path, refresh: () => setVersion(v => v + 1) };
}
export default function FeedbackAdmin() {
  const { lang } = useLang(), c = feedbackCopy[lang], session = useAccountSession();
  const [denied, setDenied] = useState(false), [query, setQuery] = useState(""), [cursor, setCursor] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null);
  const onDenied = useCallback(() => setDenied(true), []);
  const allowed = session.ready && !!session.profile?.admin && !session.denied && !denied;
  const path = allowed ? "admin/feedback?" + new URLSearchParams({ limit: "20", ...Object.fromEntries(new URLSearchParams(query)), ...(cursor ? { cursor } : {}) }) : null;
  const list = usePrivateResource<Page>(path, onDenied);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) if (typeof value === "string" && value) params.set(key, value);
    setQuery(params.toString()); setCursor(null); setSelected(null); list.refresh();
  }
  return <><main className={s.page}>
    <h1>{c.admin}</h1>{allowed && <AdminNavigation active="feedback" />}<Link href="/account/admin">{c.back}</Link>
    {!session.ready ? <p role="status">{c.loading}</p> : !allowed ? <p role="alert">{c.denied}</p> : <>
      <form onSubmit={filter} className={s.filters}>
        <label>{c.type}<select name="type" defaultValue=""><option value="">{c.all}</option>{feedbackTypes.map(key => <option key={key} value={key}>{c.types[key]}</option>)}</select></label>
        <label>{c.status}<select name="status" defaultValue=""><option value="">{c.all}</option>{feedbackStatuses.map(key => <option key={key} value={key}>{c.statuses[key]}</option>)}</select></label><button>{c.filter}</button>
      </form>
      <button onClick={list.refresh}>{c.refresh}</button>
      {selected && <FeedbackDetail key={selected} id={selected} c={c} denied={onDenied} saved={list.refresh} close={() => { document.getElementById("feedback-" + selected)?.focus(); setSelected(null); }} />}
      {list.loading ? <p role="status">{c.loading}</p> : list.error ? <p role="alert">{errorMessage(list.error, c)}</p> : !list.data?.items.length ? <p role="status">{c.empty}</p> : <div className={s.table} role="region" aria-label={c.admin} tabIndex={0}><table>
        <caption>{c.admin}</caption><thead><tr>{[c.type, c.status, c.date, c.detail].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{list.data.items.map(row => <tr key={row.id}><td>{c.types[row.type]}</td><td>{c.statuses[row.status]}</td><td>{new Date(row.createdAt).toLocaleString(lang, {timeZone:"UTC"})} UTC</td><td><button id={"feedback-" + row.id} onClick={() => setSelected(row.id)} aria-label={c.detail + " " + row.id}>{c.detail}</button></td></tr>)}</tbody>
      </table></div>}
      <div className={s.actions}><button disabled={!cursor || list.loading} onClick={() => { setCursor(null); setSelected(null); }}>{c.first}</button><button disabled={!list.data?.nextCursor || list.loading} onClick={() => { setCursor(list.data!.nextCursor); setSelected(null); }}>{c.next}</button></div>
    </>}
  </main></>;
}
function FeedbackDetail({ id, c, denied, saved, close }: { id: string; c: Copy; denied: () => void; saved: () => void; close: () => void }) {
  const detail = usePrivateResource<Detail>("admin/feedback/" + id, denied);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  async function treat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail.data) return;
    const status = new FormData(event.currentTarget).get("status");
    setBusy(true); setNotice("");
    try {
      await accountFetch("admin/feedback/" + id, "PATCH", { status, expectedStatus: detail.data.status });
      setNotice(c.saved); detail.refresh(); saved();
    } catch (error) {
      setNotice(errorMessage(error, c));
      if (error instanceof AccountClientError && [401, 403].includes(error.status)) denied();
    } finally { setBusy(false); }
  }
  return <section className={s.panel} ref={panel} tabIndex={-1} aria-label={c.detail}>
    <div className={s.actions}><h2>{c.detail} #{id}</h2><button onClick={close}>{c.cancel}</button><button onClick={detail.refresh}>{c.refresh}</button></div>
    {detail.loading && <p role="status">{c.loading}</p>}{detail.error != null && <p role="alert">{errorMessage(detail.error, c)}</p>}{notice && <p role="status">{notice}</p>}
    {detail.data && <>
      <p>{c.types[detail.data.type]} · {c.statuses[detail.data.status]}</p>
      <dl>{(["description", "page", "urls", "expected", "observed", "steps"] as const).map(key => detail.data![key] && <div key={key}><dt>{c[key]}</dt><dd className={s.text}>{key === "page" ? c.pages[detail.data!.page as keyof typeof c.pages] : detail.data![key]}</dd></div>)}</dl>
      {detail.data.findingKey && <p>{c.finding}: <code>{detail.data.findingKey}</code></p>}
      {detail.data.runId && <Link href={"/account/admin/runs/" + detail.data.runId}>{c.report}</Link>}
      <form key={detail.data.updatedAt} onSubmit={treat} className={s.filters}><label>{c.status}<select name="status" defaultValue={detail.data.status}>{feedbackStatuses.map(key => <option key={key} value={key}>{c.statuses[key]}</option>)}</select></label><button disabled={busy}>{busy ? c.loading : c.save}</button></form>
      <h3>{c.history}</h3><ul>{detail.data.events.map((event, i) => <li key={i}>{event.createdAt} · {c.actor} {event.actorId}: {c.statuses[event.oldStatus]} → {c.statuses[event.newStatus]}</li>)}</ul>
    </>}
  </section>;
}
