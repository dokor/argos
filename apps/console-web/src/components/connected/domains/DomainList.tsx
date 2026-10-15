"use client";
import DomainCommonMetric from "./DomainCommonMetric";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import type { Domains } from "@/lib/connected/contracts";
import { batchPath } from "@/lib/connected/domain-navigation";
import { domainSummaryQuery } from "@/lib/domain-summary-request";
import { PageHeading, EmptyState } from "../Primitives";
import { useDomainResource } from "./useDomainResource";
import {
  useDomainText,
  State,
  DomainError,
  Waiting,
  Pagination,
  dateLabel,
} from "./DomainUi";
import s from "../Connected.module.scss";
import d from "./Domains.module.scss";
export default function DomainList() {
  const { c, lang } = useDomainText(),
    params = useSearchParams(),
    query = domainSummaryQuery("domains", new URLSearchParams(params));
  const resource = useDomainResource<Domains>(
    query ? `domains?${query}` : null,
  );
  const href = (offset: number) => {
    const next = new URLSearchParams(query ?? undefined);
    next.set("offset", String(offset));
    return `/account/domains?${next}`;
  };
  useEffect(() => {
    window.dispatchEvent(new Event("argos-reading"));
  }, [params]);
  return (
    <main className={s.page}>
      <PageHeading
        title={c.listTitle}
        description={c.listIntro}
        action={
          <Link className={s.primary} href="/account/domains/new">
            {c.new}
          </Link>
        }
      />
      <form
        className={d.filters}
        action={lang === "en" ? "/en/account/domains" : "/account/domains"}
      >
        <label>
          {c.search}
          <input
            type="search"
            name="query"
            defaultValue={query?.get("query") ?? ""}
            maxLength={253}
          />
        </label>
        <button className={s.secondary}>{c.searchAction}</button>
        {params.size > 0 && (
          <Link className={d.link} href="/account/domains">
            {c.reset}
          </Link>
        )}
      </form>
      {!query ? (
        <DomainError code="invalid_filters" />
      ) : resource.error ? (
        <DomainError code={resource.error} retry={resource.reload} />
      ) : null}
      {query && !resource.data && !resource.error && (
        <Waiting allowed={resource.allowed} />
      )}
      {resource.data && (
        <>
          <div className={d.stack}>
            {resource.data.items.map((domain) => (
              <article className={d.card} key={domain.id}>
                <div className={d.cardHeader}>
                  <div>
                    <h2>{domain.hostname}</h2>
                    <p>
                      {domain.latestAttemptAt
                        ? `${c.lastAttempt} ${dateLabel(domain.latestAttemptAt, lang)}`
                        : c.noBatch}
                    </p>
                    {domain.batchStatus && <State value={domain.batchStatus} />}
                    <p>{c.incomplete} : {domain.counts.partialPages + domain.counts.failedPages + domain.counts.canceledPages + domain.counts.unknownPages}</p>
                  </div>
                  <Link
                    className={s.secondary}
                    href={
                      domain.latestBatchId
                        ? batchPath(domain.id, domain.latestBatchId)
                        : `/account/domains/new?hostname=${encodeURIComponent(domain.hostname)}`
                    }
                  >
                    {domain.latestBatchId ? c.open : c.new}
                  </Link>
                </div>
                <dl className={d.metrics}>
                  <div>
                    <dt>{c.priority}</dt>
                    <dd>{domain.counts.priorityPages}</dd>
                  </div>
                  <DomainCommonMetric domainId={domain.id} batchId={domain.latestBatchId} />
                  <div>
                    <dt>
                      {c.complete} / {c.selected}
                    </dt>
                    <dd>
                      {domain.counts.completePages} /{" "}
                      {domain.counts.selectedPages}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          {resource.data.items.length === 0 && (
            <EmptyState
              title={query?.get("query") ? c.noResults : c.empty}
              description={c.emptyHint}
            >
              <Link className={s.primary} href="/account/domains/new">
                {c.new}
              </Link>
            </EmptyState>
          )}
          <Pagination {...resource.data} href={href} />
          <p className={d.muted}>{c.scopeHint}</p>
        </>
      )}
    </main>
  );
}
