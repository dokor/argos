import type { ReactNode } from "react";
import Link from "@/components/LocalizedLink";
import s from "./Connected.module.scss";

export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className={s.heading}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className={s.actions}>{action}</div>}</div>;
}
export function Surface({ title, children, action }: { title: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <section className={s.surface}><div className={s.surfaceHeading}><h2>{title}</h2>{action}</div>{children}</section>;
}
export function KpiCard({ label, value, detail, href, actionLabel }: { label: string; value: string; detail: string; href?: string; actionLabel?: string }) {
  const content = <><span className={s.kpiLabel}>{label}</span><strong className={s.kpiValue}>{value}</strong><span className={s.muted}>{detail}</span>{href && actionLabel && <span className={s.kpiAction}>{actionLabel} <span aria-hidden="true">→</span></span>}</>;
  return href ? <Link className={s.kpi} href={href}>{content}</Link> : <div className={s.kpi}>{content}</div>;
}
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span className={s.badge} data-tone={tone}>{children}</span>;
}
export function EmptyState({ title, description, children, kind = "empty" }: { title: string; description?: string; children?: ReactNode; kind?: "empty" | "loading" | "error" }) {
  return <section className={s.empty} aria-busy={kind === "loading"}>
    <h2>{title}</h2>{description && <p role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}>{description}</p>}{children && <div className={s.actions}>{children}</div>}
  </section>;
}
/** Scroll is confined to this labelled keyboard-accessible region, never to the page. */
export function DataTable({ caption, columns, children }: { caption: string; columns: string[]; children: ReactNode }) {
  return <div className={s.tableRegion} role="region" aria-label={caption} tabIndex={0}><table className={s.table}>
    <caption>{caption}</caption><thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody>
  </table></div>;
}
