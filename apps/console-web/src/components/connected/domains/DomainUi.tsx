"use client";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import type { PageResult } from "@/lib/connected/contracts";
import { phrase } from "@/lib/connected/domain-navigation";
import { EmptyState, StatusBadge, DataTable } from "../Primitives";
import s from "../Connected.module.scss";
import d from "./Domains.module.scss";
export function useDomainText() {
  const { t, lang } = useLang();
  return { c: t.domainPage, lang };
}
export function State({ value }: { value: string }) {
  const { c } = useDomainText();
  return (
    <StatusBadge
      tone={
        value === "FAILED"
          ? "danger"
          : ["PARTIAL", "UNKNOWN", "NONE"].includes(value)
            ? "warning"
            : ["FULL", "COMPLETED"].includes(value)
              ? "success"
              : "neutral"
      }
    >
      {c.states[value as keyof typeof c.states] ?? value}
    </StatusBadge>
  );
}
export function Reason({ value }: { value: string | null }) {
  const { c } = useDomainText();
  return value ? (
    <>{c.reasons[value as keyof typeof c.reasons] ?? value}</>
  ) : null;
}
export function dateLabel(value: string, lang: string) {
  return new Intl.DateTimeFormat(lang, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function DomainError({
  code,
  retry,
}: {
  code: string;
  retry?: () => void;
}) {
  const { c } = useDomainText();
  const text =
    code === "invalid_filters"
      ? c.filterInvalid
      : code.includes("not_found") ||
          code === "forbidden" ||
          code === "resource_unavailable"
        ? c.missing
        : code === "email_unverified"
          ? c.verify
          : code === "discovery_expired"
            ? c.expired
            : code === "quota_exceeded"
              ? c.quotaInsufficient
              : code.startsWith("selection_")
                ? c.invalidSelection
                : code === "batch_active" || code === "discovery_active"
                  ? c.busy
                  : c.errorTitle;
  return (
    <div className={d.error} role="alert">
      <p>{text}</p>
      {retry && (
        <button className={s.secondary} onClick={retry}>
          {c.retry}
        </button>
      )}
    </div>
  );
}
export function Waiting({ allowed }: { allowed: boolean }) {
  const { c } = useDomainText();
  return (
    <EmptyState
      title={allowed ? c.loading : c.verify}
      kind={allowed ? "loading" : "empty"}
    />
  );
}
export function Pagination({
  total,
  offset,
  limit,
  href,
}: {
  total: number;
  offset: number;
  limit: number;
  href: (offset: number) => string;
}) {
  const { c } = useDomainText();
  return (
    <nav className={d.pagination} aria-label={c.pagination}>
      <p>
        {total
          ? `${offset + 1}–${Math.min(offset + limit, total)} / ${total}`
          : "0"}
      </p>
      <div className={s.actions}>
        {offset > 0 && (
          <Link
            className={s.secondary}
            href={href(Math.max(0, offset - limit))}
          >
            {c.previous}
          </Link>
        )}
        {offset + limit < total && (
          <Link className={s.secondary} href={href(offset + limit)}>
            {c.next}
          </Link>
        )}
      </div>
    </nav>
  );
}
export function ReportLink({
  page,
  returnTo,
}: {
  page: PageResult;
  returnTo: string;
}) {
  const { c } = useDomainText();
  return page.reportAvailable ? (
    <Link
      className={d.link}
      href={`/account/runs/${page.runId}?returnTo=${encodeURIComponent(returnTo)}`}
    >
      {c.diagnostic}
      <span className={d.srOnly}> — {page.normalizedUrl}</span>
    </Link>
  ) : (
    <span className={d.muted}>{c.reportUnavailable}</span>
  );
}
export function PageList({
  pages,
  returnTo,
  empty,
}: {
  pages: readonly PageResult[];
  returnTo: string;
  empty: string;
}) {
  const { c } = useDomainText();
  return pages.length ? (
    <ul className={d.pageList}>
      {pages.map((page) => (
        <li key={page.pageId} className={d.pageRow}>
          <div>
            <strong>{page.normalizedUrl}</strong>
            <div className={d.badges}>
              <State value={page.executionStatus} />
              <State value={page.completeness} />
              <span>
                {c.critical}: {page.criticalCount ?? "—"} · {c.important}:{" "}
                {page.importantCount ?? "—"}
              </span>
            </div>
            {page.failureReason && (
              <p>
                <Reason value={page.failureReason} />
              </p>
            )}
          </div>
          <ReportLink page={page} returnTo={returnTo} />
        </li>
      ))}
    </ul>
  ) : (
    <p className={d.notice}>{empty}</p>
  );
}
export function PageTable({
  pages,
  returnTo,
}: {
  pages: readonly PageResult[];
  returnTo: string;
}) {
  const { c } = useDomainText();
  return pages.length ? (
    <DataTable
      caption={c.allPages}
      columns={[c.url, c.execution, c.coverage, c.score, c.details]}
    >
      {pages.map((page) => (
        <tr key={page.pageId}>
          <th scope="row" className={d.url}>
            {page.normalizedUrl}
          </th>
          <td>
            <State value={page.executionStatus} />
            {page.failureReason && (
              <p>
                <Reason value={page.failureReason} />
              </p>
            )}
          </td>
          <td>
            <State value={page.completeness} />
            <p>
              {page.coverage.ratio === null
                ? c.notMeasured
                : `${Math.round(page.coverage.ratio * 100)} %`}
            </p>
          </td>
          <td>
            {page.score.value ?? "—"}
            {page.score.provisional && <p>{c.provisional}</p>}
            <p>
              {c.critical}: {page.criticalCount ?? "—"}
              <br />
              {c.important}: {page.importantCount ?? "—"}
            </p>
          </td>
          <td>
            <ReportLink page={page} returnTo={returnTo} />
            <details className={d.tableDetails}>
              <summary>{c.modules}</summary>
              <ul>
                {Object.entries(page.moduleStatuses).map(([module, status]) => (
                  <li key={module}>
                    {module}: <State value={status} />
                  </li>
                ))}
              </ul>
            </details>
          </td>
        </tr>
      ))}
    </DataTable>
  ) : (
    <p className={d.notice}>{c.emptyPages}</p>
  );
}
export function ConfirmDialog({
  title,
  children,
  busy,
  onClose,
  onConfirm,
  label,
  returnFocus,
}: {
  returnFocus?: RefObject<HTMLButtonElement | null>;
  title: string;
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { c } = useDomainText();
  useEffect(() => {
    const trigger =
      returnFocus?.current ?? (document.activeElement as HTMLElement | null);
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={ref}
      className={d.dialog}
      aria-labelledby="domain-confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="domain-confirm-title">{title}</h2>
      {children}
      <div className={s.actions}>
        <button
          autoFocus
          className={s.secondary}
          disabled={busy}
          onClick={onClose}
        >
          {c.cancel}
        </button>
        <button className={s.primary} disabled={busy} onClick={onConfirm}>
          {busy ? c.launching : label}
        </button>
      </div>
    </dialog>
  );
}
export { phrase };
