"use client";
import AdminNavigation from "./AdminNavigation";
import { adminQuery, safeAdminRunReturn } from "@/lib/admin-request";
import { localizedPath } from "@/lib/i18n/routes";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession } from "@/components/account/AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import Link from "@/components/LocalizedLink";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import type { Report } from "@/components/report/types";
import { copy, type AdminCopy } from "./copy";
import s from "./AdminView.module.scss";
type Run = {
  id: string;
  site: string | null;
  userId: string | null;
  status: string;
  createdAt: string;
  reportAvailable: boolean;
  modules: Record<string, string>;
  failureCode: string | null;
  attempts: number;
};
type Page = { items: Run[]; nextCursor: string | null };
function message(error: unknown, c: AdminCopy) {
  const code = error instanceof AccountClientError ? error.code : "";
  if (code === "reauth_required") return c.recent;
  if (code === "account_archived") return c.archived;
  if (code === "admin_target") return c.adminTarget;
  if (code === "resource_unavailable") return c.unavailable;
  if (error instanceof AccountClientError && error.status === 400)
    return c.invalid;
  if (error instanceof AccountClientError && [401, 403].includes(error.status))
    return c.denied;
  return c.error;
}
function useResource<T>(path: string | null, onDenied: () => void) {
  const [state, setState] = useState<{
      path: string;
      data: T | null;
      error: unknown;
    } | null>(null),
    [revision, setRevision] = useState(0);
  const refresh = () => setRevision((v) => v + 1);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let alive = true;
    queueMicrotask(() => {
      if (alive) setState(null);
    });
    void accountFetch<T>(path, "GET", undefined, controller.signal)
      .then((data) => {
        if (alive) setState({ path, data, error: null });
      })
      .catch((error) => {
        if (!alive) return;
        if (
          error instanceof AccountClientError &&
          [401, 403].includes(error.status)
        )
          onDenied();
        setState({ path, data: null, error });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [path, revision, onDenied]);
  return {
    data: state?.path === path ? state.data : null,
    error: state?.path === path ? state.error : null,
    loading: !!path && state?.path !== path,
    refresh,
  };
}
const date = (raw: string, lang: string) =>
  new Date(raw).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "UTC",
  }) + " UTC";
function stateLabel(value: string | undefined, c: AdminCopy) {
  return value ? (c.statuses[value as keyof typeof c.statuses] ?? value) : "—";
}
export default function AdminView({ runId }: { runId?: string }) {
  const { lang, t } = useLang(),
    c = copy[lang],
    session = useAccountSession(), params = useSearchParams(), router = useRouter();
  const [denied, setDenied] = useState(false),
    [reportOpen, setReportOpen] = useState(false);
  const query = adminQuery("admin/runs", new URLSearchParams(params));
  const listQuery = query ? new URLSearchParams({ limit: "20", ...Object.fromEntries(query) }) : null;
  const cursor = query?.get("cursor");
  const listUrl = "/account/admin/runs" + (params.size ? "?" + params.toString() : "");
  const returnTo = safeAdminRunReturn(params.get("returnTo")) ?? "/account/admin/runs";
  const navigate = (next: URLSearchParams) => router.push(localizedPath("/account/admin/runs" + (next.size ? "?" + next : ""), lang));
  useEffect(() => { window.dispatchEvent(new Event("argos-reading")); }, [params]);
  const onDenied = useCallback(() => setDenied(true), []),
    allowed =
      session.ready && !!session.profile?.admin && !session.denied && !denied;
  const queue = useResource<{ queued: number; running: number }>(
    allowed ? "admin/queue" : null,
    onDenied,
  );
  const list = useResource<Page>(
    allowed && !runId && listQuery ? "admin/runs?" + listQuery : null,
    onDenied,
  );
  const run = useResource<Run>(
      allowed && runId ? "admin/runs/" + runId : null,
      onDenied,
    ),
    report = useResource<Report>(
      allowed && runId && reportOpen ? "admin/runs/" + runId + "/report" : null,
      onDenied,
    );
  function filters(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget))
      if (typeof v === "string" && v.trim()) q.set(k, v.trim());
    navigate(q);
  }
  if (allowed && report.data)
    return (
      <>
        <div className={s.returnBar}><AdminNavigation active="runs" />
          <Link href={returnTo}>{c.back}</Link>
        </div>
        <ReportPage embedded params={{ report: report.data }} />
      </>
    );
  return (
    <main className={s.page}>
      <h1>
        {c.title} · {c.runs}
      </h1>
      {allowed && <AdminNavigation active="runs" />}
      {!session.ready ? (
        <p role="status">{c.loading}</p>
      ) : !allowed ? (
        <p role="alert">{c.denied}</p>
      ) : runId ? (
        <>
          <div className={s.actions}><Link href={returnTo}>{c.back}</Link><button onClick={run.refresh}>{c.refresh}</button></div>
          {run.loading && <p role="status">{c.loading}</p>}
          {run.error != null && <p role="alert">{message(run.error, c)}</p>}
          {run.data && (
            <section className={s.card}>
              <h2>{run.data.site ?? run.data.id}</h2>
              <p>
                {stateLabel(run.data.status, c)} · {c.attempts}:{" "}
                {run.data.attempts}
              </p>
              {run.data.failureCode && <p className={s.notice}>{c.failed}</p>}
              <h3>{c.modules}</h3>
              <dl>
                {Object.entries(run.data.modules).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>
                      {t.report.progress.status[
                        value as keyof typeof t.report.progress.status
                      ] ?? stateLabel(value, c)}
                    </dd>
                  </div>
                ))}
              </dl>
              {!!run.data.reportAvailable && (
                <button
                  onClick={() => {
                    setReportOpen(true);
                    report.refresh();
                  }}
                >
                  {c.report}
                </button>
              )}
              {report.loading && <p role="status">{c.loading}</p>}
              {report.error != null && (
                <p role="alert">{message(report.error, c)}</p>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <section className={s.card} aria-label={c.queued}>
            <dl className={s.metrics}>
              <div>
                <dt>{c.queued}</dt>
                <dd>{queue.data?.queued ?? "—"}</dd>
              </div>
              <div>
                <dt>{c.running}</dt>
                <dd>{queue.data?.running ?? "—"}</dd>
              </div>
            </dl>
            <p>{c.queueHelp}</p>
            {queue.error != null && (
              <p role="alert">{message(queue.error, c)}</p>
            )}
            <button
              onClick={() => {
                queue.refresh();
                list.refresh();
              }}
            >
              {c.refresh}
            </button>
          </section>
          <form key={params.toString()} className={s.filters} onSubmit={filters}>
            <label>
              {c.user}
              <input name="user" defaultValue={query?.get("user") ?? ""} />
            </label>
            <label>
              {c.site}
              <input name="site" maxLength={253} defaultValue={query?.get("site") ?? ""} />
            </label>
            <label>
              {c.status}
              <select name="status" defaultValue={query?.get("status") ?? ""}>
                <option value="">{c.all}</option>
                {["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"].map(
                  (v) => (
                    <option key={v} value={v}>
                      {stateLabel(v, c)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              {c.from}
              <input name="from" type="date" defaultValue={query?.get("from") ?? ""} />
            </label>
            <label>
              {c.until}
              <input name="until" type="date" defaultValue={query?.get("until") ?? ""} />
            </label>
            <button>{c.apply}</button>
          </form>
          {!query ? <p role="alert">{c.invalid}</p> : list.loading ? (
            <p role="status">{c.loading}</p>
          ) : list.error != null ? (
            <p role="alert">{message(list.error, c)}</p>
          ) : list.data?.items.length ? (
            <div
              className={s.table}
              tabIndex={0}
              role="region"
              aria-label={c.runs}
            >
              <table>
                <caption>{c.runs}</caption>
                <thead>
                  <tr>
                    {[c.site, c.user, c.status, c.date, c.actions].map((v) => (
                      <th scope="col" key={v}>
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.site ?? "—"}
                        <br />
                        <small>{row.id}</small>
                      </td>
                      <td>{row.userId ?? c.anonymous}</td>
                      <td>{stateLabel(row.status, c)}</td>
                      <td>{date(row.createdAt, lang)}</td>
                      <td>
                        <Link href={"/account/admin/runs/" + row.id + "?" + new URLSearchParams({ returnTo: listUrl })}>
                          {c.detail}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p role="status">{c.empty}</p>
          )}
          <div className={s.actions}>
            <button
              disabled={!cursor || list.loading}
              onClick={() => { const next = new URLSearchParams(query ?? undefined); next.delete("cursor"); navigate(next); }}
            >
              {c.first}
            </button>
            <button
              disabled={!list.data?.nextCursor || list.loading}
              onClick={() => { const next = new URLSearchParams(query ?? undefined); next.set("cursor", list.data!.nextCursor!); navigate(next); }}
            >
              {c.next}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
