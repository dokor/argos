"use client";
import { useEffect, useId, useMemo, useState } from "react";
import type { Report } from "./types";
import type { AuditScope } from "@/lib/ArgosApi";
import { useAuditSubmit } from "@/lib/useAuditSubmit";
import { createLogger } from "@/lib/logger";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ScopedRelaunch.module.scss";

export default function ScopedRelaunch({ report }: { report: Report }) {
  const { lang, t } = useLang(), fr = lang === "fr", id = useId();
  const [value, setValue] = useState("full");
  const [catalogue, setCatalogue] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/audits/scope-catalogue", { signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const body = await response.json();
      if (Array.isArray(body.checkKeys)) setCatalogue(body.checkKeys.filter((key: unknown): key is string => typeof key === "string"));
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const logger = useMemo(() => createLogger("report", { route: "/report" }), []);
  const { phase, submit, error } = useAuditSubmit({ logger, openInNewTab: true });
  const busy = phase === "submitting" || phase === "redirecting";
  const checks = [...new Set([
    ...(report.scores.coverage?.checks.map(check => check.key) ?? []),
    ...(report.scores.calculation?.checks?.map(check => check.key) ?? []),
    ...report.issues.map(issue => issue.id).filter((key): key is string => Boolean(key)),
  ])].filter(key => catalogue.includes(key) || /^lighthouse\.audit\.[a-z0-9-]{1,120}$/.test(key) || /^zap\.alert\.[a-zA-Z0-9_.-]{1,120}$/.test(key)).sort();
  const scope: AuditScope = value === "full" ? { kind: "full" } : { kind: value.startsWith("category:") ? "category" : "check", target: value.slice(value.indexOf(":") + 1) };
  return <details className={s.panel}><summary>{fr ? "Relancer une mesure" : "Run a new measurement"}</summary>
    <p id={`${id}-hint`}>{fr ? "Un nouveau rapport est créé. Une relance ciblée produit un score partiel, sans réutiliser les mesures précédentes. Elle compte comme une analyse dans votre quota." : "A new report is created. A targeted rerun produces a partial score with no previous measurements reused. It counts as one analysis against your quota."}</p>
    <form onSubmit={event => { event.preventDefault(); void submit(report.pageIdentity?.requested ?? report.url, undefined, scope); }}>
      <div className={s.field}><label htmlFor={id}>{fr ? "Périmètre de la relance" : "Rerun scope"}</label>
        <select id={id} value={value} onChange={event => setValue(event.target.value)} disabled={busy} aria-describedby={`${id}-hint`}>
          <option value="full">{fr ? "Analyse complète" : "Full analysis"}</option>
          <optgroup label={fr ? "Catégorie" : "Category"}>{["performance", "security", "seo", "a11y"].map(key => <option key={key} value={`category:${key}`}>{t.report.priorityCards.domains[key as keyof typeof t.report.priorityCards.domains]}</option>)}</optgroup>
          {checks.length > 0 && <optgroup label={fr ? "Contrôle précis" : "Specific check"}>{checks.map(key => <option key={key} value={`check:${key}`}>{key}</option>)}</optgroup>}
        </select>
      </div><button type="submit" disabled={busy} aria-busy={busy}>{busy ? t.report.hero.relaunching : t.report.hero.relaunch}</button>
    </form>
    {error && <p role="alert">{(error as Error & { code?: string }).code === "quota_exceeded" ? t.account.errors.quota_exceeded : t.report.hero.relaunchError}</p>}
  </details>;
}
