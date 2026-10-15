"use client";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { overviewQuery } from "@/lib/overview-request";
import type {
  Overview,
  TrackedPage,
  RecentRun,
} from "@/lib/connected/contracts";
import { useDomainResource } from "./domains/useDomainResource";
import { State, Pagination } from "./domains/DomainUi";
import { EmptyState, KpiCard, PageHeading, Surface } from "./Primitives";
import s from "./Connected.module.scss";
import d from "./Overview.module.scss";
import { compactCopy, compactUrl } from "./compactCopy";
const pending = (data: Overview) => data.activeRuns > 0;
export default function OverviewView() {
  const { t, lang } = useLang(),
    c = t.overviewPage,
    compact = compactCopy[lang],
    params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  const query = overviewQuery(new URLSearchParams(params)),
    suffix = params.toString();
  if (query && !params.has("limit")) query.set("limit", "6");
  const resource = useDomainResource<Overview>(
      query ? "overview?" + query : null,
      pending,
    ),
    data = resource.data;
  useEffect(() => {
    window.dispatchEvent(new Event("argos-reading"));
  }, [suffix]);
  const change = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.delete("offset");
    for (const [k, v] of Object.entries(values)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.push(pathname + (next.size ? "?" + next : ""), { scroll: false });
  };
  const number = (n: number) => new Intl.NumberFormat(lang).format(n),
    date = (v: string) =>
      new Intl.DateTimeFormat(lang, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v));
  const returnTo = pathname + (suffix ? "?" + suffix : ""),
    runLink = (id: string) =>
      "/account/runs/" + id + "?returnTo=" + encodeURIComponent(returnTo);
  const runRow = (run: RecentRun) => (
    <li key={run.attempt.runId} className={d.run}>
      <div>
        <strong className={d.url} title={run.normalizedUrl}>{compactUrl(run.normalizedUrl)}</strong>
        <p>
          <State value={run.attempt.executionStatus} />{" "}
          <time dateTime={run.attempt.createdAt}>
            {date(run.attempt.createdAt)}
          </time>
        </p>
      </div>
      <Link className={d.action} href={runLink(run.attempt.runId)}>
        {c.openRun}
        <span className={d.srOnly}> {run.normalizedUrl}</span>
      </Link>
    </li>
  );
  const pageRow = (page: TrackedPage) => {
    const r = page.result,
      a = page.latestAttempt,
      old = page.latestAvailableReport;
    return (
      <li className={d.row} key={page.pageId}>
        <div>
          <strong className={d.url} title={page.normalizedUrl}>{compactUrl(page.normalizedUrl)}</strong>
          <p className={d.states}>
            {a ? (
              <>
                <State value={a.executionStatus} />
                {r && <State value={r.completeness} />}
              </>
            ) : (
              <span>{c.never}</span>
            )}
            {r?.criticalCount !== null && r?.criticalCount !== undefined ? (
              <span>
                {c.critical}: {number(r.criticalCount)} · {c.important}:{" "}
                {number(r.importantCount ?? 0)}
              </span>
            ) : (
              <span>{c.noMeasurement}</span>
            )}
          </p>
          <details className={d.details}><summary>{compact.details}</summary>
          <Link className={d.site} href={"/account/sites/" + page.domainId}>{page.hostname}</Link>
          {a && (
            <p className={d.meta}>
              {c.lastAttempt}{" "}
              <time dateTime={a.createdAt}>{date(a.createdAt)}</time>
            </p>
          )}
          {r && (
            <p className={d.meta}>
              {c.score}:{" "}
              {r.score.value === null ? c.unknown : `${r.score.value}/100`}
              {r.score.provisional ? ` · ${c.provisional}` : ""} · {c.coverage}:{" "}
              {r.coverage.ratio === null
                ? c.unknown
                : new Intl.NumberFormat(lang, {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(r.coverage.ratio)}
            </p>
          )}
          </details>
          {a && a.executionStatus === "FAILED" && (
            <p className={d.meta}>{c.failedHint}</p>
          )}
          {old && old.runId !== a?.runId && (
            <p className={d.historical}>
              <span>
                {c.olderReport} · {date(old.publishedAt)}
              </span>
              <Link href={runLink(old.runId)}>
                {c.openOlder}
                <span className={d.srOnly}> {page.normalizedUrl}</span>
              </Link>
            </p>
          )}
        </div>
        <div className={d.rowActions}>
          {a && (
            <Link className={d.action} href={runLink(a.runId)}>
              {r?.reportAvailable ? c.diagnostic : c.openRun}
              <span className={d.srOnly}> {page.normalizedUrl}</span>
            </Link>
          )}
          <Link
            className={d.action}
            href={
              "/account/analyses/new?url=" +
              encodeURIComponent(page.normalizedUrl)
            }
          >
            {a ? c.relaunch : c.analyse}
            <span className={d.srOnly}> {page.normalizedUrl}</span>
          </Link>
        </div>
      </li>
    );
  };
  return (
    <main className={s.page}>
      <PageHeading
        title={t.connected.overview}
        description={c.intro}
        action={
          <>
            <button
              className={s.secondary}
              onClick={resource.reload}
              disabled={resource.loading}
            >
              {c.refresh}
            </button>
            <Link className={s.primary} href="/account/analyses/new">
              {c.new}
            </Link>
          </>
        }
      />
      {!query ? (
        <EmptyState kind="error" title={c.invalid} description={c.invalidHint}>
          <Link href="/account" className={s.secondary}>
            {c.reset}
          </Link>
        </EmptyState>
      ) : !resource.allowed ? (
        <EmptyState title={t.account.pending} />
      ) : (
        <>
          {resource.error && (
            <div className={d.error} role="alert">
              <strong>{data ? c.stale : c.error}</strong>
              <p>{c.errorHint}</p>
              <button className={s.secondary} onClick={resource.reload}>
                {c.retry}
              </button>
            </div>
          )}
          {!data && !resource.error ? (
            <EmptyState title={t.connected.loading} kind="loading" />
          ) : (
            data && (
              <>
                <div className={`${s.kpis} ${d.kpis}`}>
                  <KpiCard
                    label={c.priority}
                    value={number(data.priorityUrls)}
                    detail={`${number(data.trackedUrls)} ${c.tracked} · ${c.measured}`}
                    href="/account?attention=priority"
                    actionLabel={compact.corrections}
                  />
                  <KpiCard
                    label={c.incomplete}
                    value={number(data.incompleteUrls)}
                    detail={c.incompleteHint}
                    href="/account?attention=incomplete"
                    actionLabel={compact.coverage}
                  />
                  <KpiCard
                    label={c.credits}
                    value={
                      data.usage.available === null
                        ? c.unlimited
                        : number(data.usage.available)
                    }
                    detail={`${c.reserved}: ${number(data.usage.reserved)} · ${c.resets} ${date(data.usage.resetsAt)}`}
                    href="/account/usage"
                    actionLabel={compact.quota}
                  />
                </div>
                <p className={d.scope}>
                  {c.scope} · {c.updated}{" "}
                  <time dateTime={data.snapshotAt}>
                    {date(data.snapshotAt)}
                  </time>
                  <br />
                  {c.overlap}
                </p>
                {!data.usage.canLaunch && (
                  <p className={d.notice}>
                    {c.quotaBlocked}{" "}
                    <Link href="/account/usage">{c.usage}</Link>
                  </p>
                )}
                {data.activeRuns > 0 && (
                  <Surface title={`${c.active} (${number(data.activeRuns)})`}>
                    <p className={d.meta}>{c.activeHint}</p>
                    <ul className={d.list}>
                      {data.activeAttempts.map(runRow)}
                    </ul>
                    {data.activeRuns > data.activeAttempts.length && (
                      <Link href="/account?attention=active">
                        {c.allActive}
                      </Link>
                    )}
                  </Surface>
                )}
                <Surface
                  title={c.inventory}
                  action={<Link href="/account/sites">{c.sites}</Link>}
                >
                  <nav className={d.filters} aria-label={c.filters}>
                    {[
                      [null, c.all, data.trackedUrls],
                      ["priority", c.priority, data.priorityUrls],
                      ["incomplete", c.incomplete, data.incompleteUrls],
                    ].map(([key, label, count]) => (
                      <Link
                        key={String(key)}
                        href={"/account" + (key ? "?attention=" + key : "")}
                        aria-current={
                          (params.get("attention") ?? null) === key
                            ? "page"
                            : undefined
                        }
                      >
                        {label} · {count}
                      </Link>
                    ))}
                  </nav>
                  <form
                    className={d.search}
                    key={params.get("query") ?? ""}
                    onSubmit={(e) => {
                      e.preventDefault();
                      change({
                        query: String(
                          new FormData(e.currentTarget).get("query") ?? "",
                        ),
                      });
                    }}
                  >
                    <div>
                      <label htmlFor="overview-query">{c.search}</label>
                      <input
                        id="overview-query"
                        name="query"
                        type="search"
                        maxLength={2048}
                        defaultValue={params.get("query") ?? ""}
                      />
                    </div>
                    <button className={s.secondary}>{c.searchAction}</button>
                    {params.size > 0 && (
                      <Link href="/account" className={s.secondary}>
                        {c.reset}
                      </Link>
                    )}
                  </form>
                  {params.get("domainId") && (
                    <p className={d.meta}>
                      {c.domainFilter} #{params.get("domainId")}
                    </p>
                  )}
                  <p className={d.meta}>
                    {number(data.pages.total)} {c.results}
                  </p>
                  {data.pages.items.length ? (
                    <ul className={d.list}>{data.pages.items.map(pageRow)}</ul>
                  ) : (
                    <EmptyState
                      title={data.trackedUrls === 0 ? c.empty : c.noResults}
                      description={
                        data.trackedUrls === 0 ? c.emptyHint : c.noResultsHint
                      }
                    >
                      {data.trackedUrls === 0 && (
                        <Link
                          className={s.primary}
                          href="/account/analyses/new"
                        >
                          {c.new}
                        </Link>
                      )}
                    </EmptyState>
                  )}
                  <Pagination
                    total={data.pages.total}
                    limit={data.pages.limit}
                    offset={data.pages.offset}
                    href={(offset) => {
                      const next = new URLSearchParams(params);
                      next.set("offset", String(offset));
                      return "/account?" + next;
                    }}
                  />
                </Surface>
                <div className={s.twoColumns}>
                  <Surface title={compact.recent}>
                    {data.recentRuns.length ? (
                      <ul className={d.list}>{data.recentRuns.slice(0, 1).map(runRow)}</ul>
                    ) : (
                      <p className={d.meta}>{c.noRuns}</p>
                    )}
                    <Link className={d.action} href="/account/sites">{compact.history}</Link>
                  </Surface>
                  <Surface title={c.domainTitle}>
                    <p className={d.promotion}>{c.domainHint}</p>
                    <Link href="/account/domains/new" className={s.primary}>
                      {c.domainAction}
                    </Link>
                    <p className={d.meta}>{c.discoveryFree}</p>
                    <Link href="/account/domains">{c.domains}</Link>
                  </Surface>
                </div>
              </>
            )
          )}
        </>
      )}
    </main>
  );
}
