"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { useAccountSession } from "@/components/account/AccountSession";
import ExecutionStatusBadge from "@/components/connected/ExecutionStatusBadge";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { adminQuery, safeAdminQueueReturn } from "@/lib/admin-request";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import AdminNavigation from "./AdminNavigation";
import RunFilterSelect from "./RunFilterSelect";
import { copy } from "./copy";
import { queueCopy, type QueueType } from "./queueCopy";
import s from "./AdminView.module.scss";
import q from "./QueueView.module.scss";

type Task = {
  type: QueueType; id: string; site: string | null; displayUrl: string | null;
  userId: string | null; resolvedUserId: string | null; userDisplayName: string | null; userEmail: string | null;
  status: string; diagnostic: keyof typeof queueCopy.fr.diagnostics; createdAt: string; startedAt: string | null;
  finishedAt: string | null; waitSeconds: number | null; elapsedSeconds: number | null;
  pageCount: number | null; queuedChildren: number | null; runningChildren: number | null; batchId: string | null;
  children?: Task[]; snapshotAt?: string; stuckSeconds?: number;
};
type Snapshot = { items: Task[]; hasMore: boolean; page: number; counts: {type: QueueType; queued: number; running: number}[]; snapshotAt: string; stuckSeconds: number };
const duration = (seconds: number | null) => seconds == null ? "—" : seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${Math.floor(seconds / 60)} min` : `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;

export default function QueueView({ type, id }: { type?: QueueType; id?: string }) {
  const { lang } = useLang(), c = copy[lang], text = queueCopy[lang], session = useAccountSession();
  const params = useSearchParams(), router = useRouter();
  const [denied, setDenied] = useState(false), [revision, setRevision] = useState(0);
  const onDenied = useCallback(() => setDenied(true), []);
  const allowed = session.ready && !!session.profile?.admin && !!session.profile.verified && !session.denied && !denied;
  const query = adminQuery("admin/queue/tasks", new URLSearchParams(params));
  const path = id && type ? `admin/queue/tasks/${type}/${id}` : query ? "admin/queue/tasks?" + query : null;
  const [resource, setResource] = useState<{path: string; data?: Snapshot | Task; error?: unknown} | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!allowed || !path) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setLoading(true); });
    void accountFetch<Snapshot | Task>(path, "GET", undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResource({path, data}); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof AccountClientError && [401,403].includes(error.status)) onDenied();
        setResource({path, error});
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [allowed, path, revision, onDenied]);
  const data = allowed && resource?.path === path ? resource.data : undefined;
  const error = allowed && resource?.path === path ? resource.error : undefined;
  const snapshot = !id ? data as Snapshot | undefined : undefined, task = id ? data as Task | undefined : undefined;
  const returnTo = id ? safeAdminQueueReturn(params.get("returnTo")) ?? "/account/admin/queue" : "/account/admin/queue" + (params.size ? "?" + params : "");
  const page = Number(query?.get("page") ?? 1);
  const navigate = (next: URLSearchParams) => router.push(localizedPath("/account/admin/queue" + (next.size ? "?" + next : ""), lang));
  const date = (raw: string | null) => raw ? new Date(raw).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {timeZone: "UTC"}) + " UTC" : "—";
  const detailHref = (row: Task) => `/account/admin/queue/${row.type}/${row.id}?` + new URLSearchParams({returnTo});
  const userHref = (row: Task) => `/account/admin/users/${row.resolvedUserId}?` + new URLSearchParams({returnTo});
  function filters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key,value] of new FormData(event.currentTarget)) if (typeof value === "string" && value.trim()) next.set(key, value.trim());
    navigate(next);
  }
  const owner = (row: Task) => row.resolvedUserId ? <Link href={userHref(row)}>{row.userDisplayName?.trim() || row.userEmail || c.missingUser}</Link> : <span>{row.userId ? c.missingUser : c.anonymous}</span>;
  const diagnosis = (row: Task) => <span className={["OBSERVED","TERMINAL"].includes(row.diagnostic) ? q.observed : q.warning}>{text.diagnostics[row.diagnostic]}</span>;
  const timing = (row: Task) => <div className={q.timing}>
    <time dateTime={row.createdAt}>{date(row.createdAt)}</time>
    <span className={q.meta}>{text.started}: {row.startedAt ? date(row.startedAt) : text.notStarted}</span>
    <span className={q.meta}>{text.waiting}: {duration(row.waitSeconds)}{row.startedAt && <> · {text.elapsed}: {duration(row.elapsedSeconds)}</>}</span>
  </div>;
  function table(items: Task[], title: string, children = false) {
    return <div className={s.table} tabIndex={0} role="region" aria-label={title}><table>
      <caption>{title}</caption><thead><tr><th scope="col">{text.type}</th><th scope="col">{c.site} / URL</th><th scope="col">{c.status}</th><th scope="col">{c.user}</th><th scope="col">{text.submitted} / {text.waiting}</th><th scope="col">{c.detail}</th></tr></thead>
      <tbody>{items.map(row => <tr key={row.type + row.id}>
        <td>{text.types[row.type]}{row.batchId && <small className={q.meta}>{text.batch} #{row.batchId}</small>}</td>
        <td><strong>{row.site ?? c.unavailableTarget}</strong><span className={q.target}>{row.type === "RUN" ? row.displayUrl ?? c.unavailableTarget : row.type === "BATCH" ? `${row.pageCount ?? "—"} ${text.units}` : text.types.DISCOVERY}</span>
          {row.type === "BATCH" && <small className={q.meta}>{row.queuedChildren} {text.queued} · {row.runningChildren} {text.running}</small>}</td>
        <td><ExecutionStatusBadge state={row.status}/>{diagnosis(row)}</td><td>{owner(row)}</td><td>{timing(row)}</td>
        <td><Link href={children ? "/account/admin/runs/" + row.id + "?" + new URLSearchParams({returnTo}) : detailHref(row)}>{c.detail}</Link></td>
      </tr>)}</tbody>
    </table></div>;
  }
  const snapshotAt = snapshot?.snapshotAt ?? task?.snapshotAt, stuckSeconds = snapshot?.stuckSeconds ?? task?.stuckSeconds;
  return <main className={s.page}>
    <h1>{c.title} · {text.title}</h1>
    {allowed && <AdminNavigation active="queue"/>}
    {!session.ready ? <p role="status">{c.loading}</p> : !allowed ? <p role="alert">{c.denied}</p> : <>
      <p className={q.intro}>{text.intro}</p>
      <div className={s.actions}>{id && <Link href={returnTo}>{text.back}</Link>}<button disabled={loading} onClick={() => setRevision(value => value + 1)}>{c.refresh}</button>
        {snapshotAt && <span>{text.updated} <time dateTime={snapshotAt}>{date(snapshotAt)}</time></span>}</div>
      {(loading || !resource && path) && <p role="status">{c.loading}</p>}
      {!path && <p role="alert">{c.invalid}</p>}
      {error != null && <p role="alert">{error instanceof AccountClientError && error.status === 400 ? c.invalid : error instanceof AccountClientError && error.status === 404 ? text.unavailable : c.error}</p>}
      {!id && <>
        {snapshot && <><dl className={q.counts} aria-label={text.global}>{snapshot.counts.map(count => <div key={count.type}><dt>{text.types[count.type]}</dt><dd><span><strong>{count.queued}</strong>{text.queued}</span><span><strong>{count.running}</strong>{text.running}</span></dd></div>)}</dl><p>{text.scope}</p></>}
        <form key={params.toString()} className={s.filters} onSubmit={filters}>
          <label>{text.type}<select name="type" defaultValue={query?.get("type") ?? ""}><option value="">{text.allTypes}</option>{Object.entries(text.types).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>{c.status}<select name="status" defaultValue={query?.get("status") ?? ""}><option value="">{c.allStatuses}</option><option value="QUEUED">{c.statuses.QUEUED}</option><option value="RUNNING">{c.statuses.RUNNING}</option></select></label>
          <RunFilterSelect kind="site" initial={query?.get("site") ?? ""} onDenied={onDenied}/><RunFilterSelect kind="user" initial={query?.get("user") ?? ""} onDenied={onDenied}/>
          <label>{c.from}<input type="date" name="from" defaultValue={query?.get("from") ?? ""}/></label><label>{c.until}<input type="date" name="until" defaultValue={query?.get("until") ?? ""}/></label>
          <label>{text.sort}<select name="sort" defaultValue={query?.get("sort") ?? "oldest"}>{Object.entries(text.sorts).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className={s.filterActions}><button>{c.apply}</button><button type="button" onClick={() => navigate(new URLSearchParams())}>{c.resetFilters}</button></div>
        </form>
        <p>{text.period}. {text.hierarchy}</p>
        {snapshot && <>{snapshot.items.length ? table(snapshot.items, text.tasks) : <p role="status">{text.empty}</p>}
          <div className={s.actions}>{page > 1 && <button onClick={() => {const next = new URLSearchParams(params); next.set("page", String(page - 1)); navigate(next);}}>{text.previous}</button>}
            <span>{text.page} {page}</span>{snapshot.hasMore && <button onClick={() => {const next = new URLSearchParams(params); next.set("page", String(page + 1)); navigate(next);}}>{c.next}</button>}</div></>}
      </>}
      {task && <><h2 className={q.heading}>{text.detail} · {task.site ?? c.unavailableTarget}</h2>{table([task], text.types[task.type])}
        {task.type === "RUN" && <Link href={"/account/admin/runs/" + task.id + "?" + new URLSearchParams({returnTo})}>{c.modules} · {text.run}</Link>}
        {task.children && <><h2>{text.urls}</h2>{task.children.length ? table(task.children, text.urls, true) : <p>{text.unavailable}</p>}</>}
        <details className={q.details}><summary>{text.identifiers}</summary><p>{task.type} #{task.id}{task.userId && <> · {c.user} #{task.userId}</>}{task.batchId && <> · {text.batch} #{task.batchId}</>}</p></details>
      </>}
      <p>{text.help}</p>{stuckSeconds != null && <p>{text.threshold.replace("{minutes}", String(stuckSeconds / 60))}</p>}
    </>}
  </main>;
}
