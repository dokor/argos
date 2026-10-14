"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { localizedPath } from "@/lib/i18n/routes";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession } from "@/components/account/AccountSession";
import type {
  BatchSummary,
  BatchPages,
  Batches,
} from "@/lib/connected/contracts";
import {
  batchPath,
  domainFilters,
  validDomainId,
} from "@/lib/connected/domain-navigation";
import { PageHeading, Surface, KpiCard, StatusBadge } from "../Primitives";
import {
  useDomainResource,
  activeStatus,
  followPages,
} from "./useDomainResource";
import {
  useDomainText,
  State,
  Reason,
  DomainError,
  Waiting,
  Pagination,
  PageList,
  PageTable,
  ConfirmDialog,
  dateLabel,
  phrase,
} from "./DomainUi";
import s from "../Connected.module.scss";
import d from "./Domains.module.scss";
export default function DomainBatch({
  domainId,
  batchId,
}: {
  domainId: string;
  batchId: string;
}) {
  const { c, lang } = useDomainText(),
    params = useSearchParams(),
    router = useRouter(),
    session = useAccountSession();
  const filters = domainFilters(new URLSearchParams(params)),
    valid = validDomainId(domainId) && validDomainId(batchId) && !!filters;
  const base = batchPath(domainId, batchId),
    api = `domains/${domainId}/batches/${batchId}`;
  const summary = useDomainResource<BatchSummary>(
      valid ? api : null,
      activeStatus,
    ),
    batch = summary.data,
    running = !!batch && activeStatus(batch);
  const pages = useDomainResource<BatchPages>(
    valid && batch
      ? `${api}/pages?${filters?.tab === "pages" ? filters.query : "limit=100"}`
      : null,
    running ? followPages : undefined,
  );
  const history = useDomainResource<Batches>(
    valid
      ? `domains/${domainId}/batches?limit=5&offset=${filters?.historyOffset ?? 0}`
      : null,
  );
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (batch?.status) window.dispatchEvent(new Event("argos-usage-refresh"));
  }, [batch?.status]);
  const link = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const returnTo = localizedPath(
    `${base}${params.size ? `?${params}` : ""}`,
    lang,
  );
  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await accountFetch(`${api}/cancel`, "POST", {});
      setConfirm(false);
      summary.reload();
      session.refreshUsage();
    } catch (reason) {
      session.invalidate(reason);
      setError(
        reason instanceof AccountClientError
          ? reason.code
          : "account_unavailable",
      );
    } finally {
      setBusy(false);
    }
  };
  const refresh = () => {
    summary.reload();
    pages.reload();
    history.reload();
  };
  useEffect(() => {
    window.dispatchEvent(new Event("argos-reading"));
  }, [params]);
  return (
    <main className={s.page}>
      <Link className={d.link} href="/account/domains">
        ← {c.back}
      </Link>
      <PageHeading
        title={batch?.hostname ?? c.listTitle}
        description={c.scopeHint}
        action={
          <>
            <button className={s.secondary} onClick={refresh}>
              {c.refresh}
            </button>
            {batch && (
              <Link
                className={s.primary}
                href={`/account/domains/new?hostname=${encodeURIComponent(batch.hostname)}`}
              >
                {c.newRun}
              </Link>
            )}
          </>
        }
      />
      {!valid ? (
        <DomainError code="invalid_filters" />
      ) : summary.error ? (
        <DomainError code={summary.error} retry={refresh} />
      ) : !batch ? (
        <Waiting allowed={summary.allowed} />
      ) : null}
      {batch && valid && (
        <>
          <Surface title={c.scope} action={<State value={batch.status} />}>
            <p>{c.sameHost}</p>
            <dl className={d.facts}>
              <div>
                <dt>
                  {c.selected} / {c.eligible}
                </dt>
                <dd>
                  {batch.counts.selectedPages} / {batch.discovery.eligiblePages}
                </dd>
              </div>
              <div>
                <dt>{c.excluded}</dt>
                <dd>{batch.discovery.excludedPages}</dd>
              </div>
              <div>
                <dt>{c.profile}</dt>
                <dd>
                  {batch.profileSnapshot.profileId} · v
                  {batch.profileSnapshot.scoringVersion}
                </dd>
              </div>
              <div>
                <dt>{c.created}</dt>
                <dd>{dateLabel(batch.createdAt, lang)}</dd>
              </div>
            </dl>
            <p className={d.muted}>{c.profileHint}</p>
            <p className={d.muted}>
              {phrase(c.limitText, {
                urls: batch.discovery.effectiveLimits.maxUrls,
                depth: batch.discovery.effectiveLimits.maxDepth,
                seconds: batch.discovery.effectiveLimits.durationSeconds,
                requests: batch.discovery.effectiveLimits.requestsPerHost,
              })}
            </p>
            {batch.discovery.truncated && (
              <p className={d.notice}>
                {c.truncated} · <Reason value={batch.discovery.stopReason} />
              </p>
            )}
          </Surface>
          {(running || batch.cancelRequested) && (
            <Surface
              title={c.progressTitle}
              action={<State value={batch.status} />}
            >
              <p>{c.progressHint}</p>
              <progress
                className={d.meter}
                max={batch.counts.selectedPages}
                value={batch.counts.selectedPages - batch.counts.activePages}
                aria-label={c.progressTitle}
              />
              <p aria-live="polite">
                {phrase(c.progressCount, {
                  done: batch.counts.selectedPages - batch.counts.activePages,
                  total: batch.counts.selectedPages,
                })}
              </p>
              {batch.cancelRequested ? (
                <p>{c.cancelRequested}</p>
              ) : (
                <button
                  className={s.secondary}
                  onClick={() => setConfirm(true)}
                >
                  {c.cancelBatch}
                </button>
              )}
            </Surface>
          )}
          <nav className={d.tabs} aria-label={c.batch}>
            <Link
              href={link({ tab: null, offset: null })}
              aria-current={filters?.tab === "summary" ? "page" : undefined}
            >
              {c.summary}
            </Link>
            <Link
              href={link({ tab: "pages", offset: null })}
              aria-current={filters?.tab === "pages" ? "page" : undefined}
            >
              {c.allPages} ({batch.counts.selectedPages})
            </Link>
          </nav>
          {filters?.tab === "summary" ? (
            <>
              <div className={s.kpis}>
                <KpiCard
                  label={c.priority}
                  value={String(batch.counts.priorityPages)}
                  detail={c.priorityHint}
                  href={`${base}?tab=pages&scope=problematic`}
                />
                <KpiCard
                  label={c.common}
                  value={String(batch.commonFindings.length)}
                  detail={c.commonHint}
                />
                <KpiCard
                  label={`${c.complete} / ${c.selected}`}
                  value={`${batch.counts.completePages} / ${batch.counts.selectedPages}`}
                  detail={c.coverageHint}
                  href={`${base}?tab=pages&scope=incomplete`}
                />
              </div>
              <Surface title={c.common}>
                <p className={d.muted}>{c.commonHint}</p>
                {!batch.commonFindings.length && (
                  <p className={d.notice}>
                    {c.commonEmpty} {c.commonEmptyHint}
                  </p>
                )}
                {batch.commonFindings.map((finding, index) => (
                  <details
                    key={`${finding.ruleKey}:${finding.definitionVersion}`}
                    className={d.finding}
                    open={index === 0}
                  >
                    <summary>
                      <div>
                        <strong>{finding.title ?? finding.ruleKey}</strong>
                        <span className={d.muted}>
                          {c.categories[finding.category]} ·{" "}
                          {finding.provenance.join(", ")}
                        </span>
                      </div>
                      <StatusBadge
                        tone={
                          finding.severity === "CRITICAL"
                            ? "danger"
                            : finding.severity === "IMPORTANT"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {c.severities[finding.severity]}
                      </StatusBadge>
                    </summary>
                    <progress
                      className={d.meter}
                      max={Math.max(1, finding.evaluatedPages)}
                      value={finding.affectedPages}
                      aria-label={c.affectedPages}
                    />
                    <p>
                      {phrase(c.affected, {
                        affected: finding.affectedPages,
                        evaluated: finding.evaluatedPages,
                        selected: finding.selectedPages,
                      })}
                    </p>
                    {finding.notEvaluatedPages > 0 && (
                      <p>
                        {phrase(c.notEvaluated, {
                          count: finding.notEvaluatedPages,
                        })}
                      </p>
                    )}
                    {finding.exclusions.length > 0 && (
                      <ul>
                        {finding.exclusions.map((item) => (
                          <li key={item.reason}>
                            <Reason value={item.reason} /> : {item.pages}
                          </li>
                        ))}
                      </ul>
                    )}
                    <h3>{c.impact}</h3>
                    <p>{finding.impact ?? c.descriptionUnavailable}</p>
                    <h3>{c.recommendation}</h3>
                    <p>{finding.recommendation ?? c.descriptionUnavailable}</p>
                    <p className={d.muted}>
                      {finding.evidenceAvailable ? c.evidence : c.noEvidence}
                    </p>
                    <Link
                      className={s.secondary}
                      href={`${base}?${new URLSearchParams({ tab: "pages", rule: finding.ruleKey, definitionVersion: finding.definitionVersion })}`}
                    >
                      {c.affectedPages} ({finding.affectedPages})
                    </Link>
                    {pages.data && (
                      <>
                        <h3>{c.examples}</h3>
                        <PageList
                          pages={pages.data.items.filter((page) =>
                            finding.examplePageIds.includes(page.pageId),
                          )}
                          returnTo={returnTo}
                          empty={c.reportUnavailable}
                        />
                      </>
                    )}
                  </details>
                ))}
              </Surface>
              <Surface
                title={c.priorityTitle}
                action={
                  <Link
                    className={d.link}
                    href={`${base}?tab=pages&scope=problematic`}
                  >
                    {c.allPages}
                  </Link>
                }
              >
                <p className={d.muted}>{c.priorityOrder}</p>
                <PageList
                  pages={batch.problematicPages}
                  returnTo={returnTo}
                  empty={c.priorityEmpty}
                />
              </Surface>
              <Surface
                title={c.coverageTitle}
                action={
                  <Link
                    className={d.link}
                    href={`${base}?tab=pages&scope=incomplete`}
                  >
                    {c.seeIncomplete}
                  </Link>
                }
              >
                <p className={d.muted}>{c.coverageHint}</p>
                <PageList
                  pages={batch.incompletePages}
                  returnTo={returnTo}
                  empty={c.coverageEmpty}
                />
              </Surface>
            </>
          ) : (
            <Surface title={c.allPages}>
              <form
                key={params.toString()}
                className={d.filters}
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget),
                    next = new URLSearchParams({ tab: "pages" });
                  for (const [key, value] of form)
                    if (String(value)) next.set(key, String(value));
                  router.push(localizedPath(`${base}?${next}`, lang));
                }}
              >
                <label>
                  {c.query}
                  <input
                    name="query"
                    type="search"
                    maxLength={2048}
                    defaultValue={filters?.query.get("query") ?? ""}
                  />
                </label>
                {(
                  [
                    [
                      "scope",
                      c.scopeFilter,
                      {
                        all: c.all,
                        problematic: c.priority,
                        incomplete: c.incomplete,
                      },
                    ],
                    ["severity", c.severity, c.severities],
                    [
                      "status",
                      c.status,
                      {
                        QUEUED: c.states.QUEUED,
                        RUNNING: c.states.RUNNING,
                        COMPLETED: c.states.COMPLETED,
                        FAILED: c.states.FAILED,
                        CANCELED: c.states.CANCELED,
                      },
                    ],
                    [
                      "completeness",
                      c.completeness,
                      {
                        FULL: c.states.FULL,
                        PARTIAL: c.states.PARTIAL,
                        NONE: c.states.NONE,
                        UNKNOWN: c.states.UNKNOWN,
                      },
                    ],
                    [
                      "sort",
                      c.sort,
                      { priority: c.prioritySort, url: c.urlSort },
                    ],
                  ] as const
                ).map(([key, label, options]) => (
                  <label key={key}>
                    {label}
                    <select
                      aria-label={label}
                      name={key}
                      defaultValue={filters?.query.get(key) ?? ""}
                    >
                      <option value="">{c.all}</option>
                      {Object.entries(options).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {filters?.query.get("ruleKey") && (
                  <>
                    <input
                      type="hidden"
                      name="rule"
                      value={filters.query.get("ruleKey")!}
                    />
                    {filters.query.get("definitionVersion") && (
                      <input
                        type="hidden"
                        name="definitionVersion"
                        value={filters.query.get("definitionVersion")!}
                      />
                    )}
                    <p>
                      {c.rule}: {filters.query.get("ruleKey")}
                    </p>
                  </>
                )}
                <button className={s.secondary}>{c.apply}</button>
                <Link className={d.link} href={`${base}?tab=pages`}>
                  {c.reset}
                </Link>
              </form>
              {pages.error && (
                <DomainError code={pages.error} retry={pages.reload} />
              )}
              {!pages.data && !pages.error ? (
                <Waiting allowed={pages.allowed} />
              ) : (
                pages.data && (
                  <>
                    <PageTable pages={pages.data.items} returnTo={returnTo} />
                    <Pagination
                      {...pages.data}
                      href={(offset) => link({ offset: String(offset) })}
                    />
                  </>
                )
              )}
            </Surface>
          )}
          <Surface title={c.usage}>
            <dl className={d.facts}>
              <div>
                <dt>{c.reserved}</dt>
                <dd>{batch.usage.reserved}</dd>
              </div>
              <div>
                <dt>{c.counted}</dt>
                <dd>{batch.usage.counted}</dd>
              </div>
              <div>
                <dt>{c.released}</dt>
                <dd>{batch.usage.released}</dd>
              </div>
            </dl>
            <Link className={d.link} href="/account/usage">
              {c.usage}
            </Link>
          </Surface>
          <Surface title={c.history}>
            {history.error && (
              <DomainError code={history.error} retry={history.reload} />
            )}
            {history.data && (
              <>
                <ul className={d.history}>
                  {history.data.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        className={d.link}
                        href={batchPath(domainId, item.id)}
                        aria-current={item.id === batchId ? "page" : undefined}
                      >
                        {dateLabel(item.createdAt, lang)} · #{item.id}
                      </Link>
                      <State value={item.status} />
                      <span>
                        {item.counts.completePages} /{" "}
                        {item.counts.selectedPages} {c.complete}
                      </span>
                    </li>
                  ))}
                </ul>
                <Pagination
                  {...history.data}
                  href={(offset) => link({ historyOffset: String(offset) })}
                />
              </>
            )}
          </Surface>
          <p className={d.muted}>
            {c.updated} {dateLabel(batch.snapshotAt, lang)}
          </p>
        </>
      )}
      {error && <DomainError code={error} />}
      {confirm && (
        <ConfirmDialog
          title={c.cancelTitle}
          busy={busy}
          onClose={() => setConfirm(false)}
          onConfirm={() => void cancel()}
          label={c.cancelBatch}
        >
          <p>{c.cancelHint}</p>
          {error && <DomainError code={error} />}
        </ConfirmDialog>
      )}
    </main>
  );
}
