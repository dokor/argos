"use client";

import React from "react";
import { Report, Issue } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { scoreChipTheme } from "./reportColors";
import { buildReportModel, FindingSelection, ReportModel } from "./reportModel";
import s from "./IssuesByCategory.module.scss";
import FindingDetails from "./FindingDetails";
import ReportFeedback from "@/components/feedback/ReportFeedback";
import { cleanEvidence, findingContent } from "./findingCatalogue";
import { reportReadingCopy } from "./reportReadingCopy";
import { domainScore } from "./reportSummaryModel";
import { decisionCopy } from "./decisionCopy";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SevKey = "critical" | "important" | "info";

function sevWeight(sev: Issue["severity"]) {
  return sev === "critical" ? 0 : sev === "important" ? 1 : 2;
}

type Filter = "all" | SevKey;

// ─── Main component ───────────────────────────────────────────────────────────

export default function IssuesByCategory({ report, model = buildReportModel(report), selection, domain = "all", severity, onFilterChange, initialOpenKey }: {
  report: Report; model?: ReportModel; selection?: FindingSelection; domain?: string; severity?: string;
  initialOpenKey?: string;
  onFilterChange?: (domain: string, severity: string) => void;
}) {
  const { t, lang } = useLang();
  const copy = reportReadingCopy[lang];
  const ti = t.report.issuesByCategory;
  const catInfo = t.report.categoryInfo as Record<string, string>;
  const [filter, setFilter] = React.useState<Filter>("all");

  const [activeSelection, setActiveSelection] = React.useState(selection);
  const effectiveFilter = severity ?? (selection && activeSelection !== selection ? "all" : filter);
  if (selection && activeSelection !== selection) {
    setActiveSelection(selection);
    setFilter("all");
  }
  React.useEffect(() => {
    if (!selection) return;
    const finding = model.findings.find(item => item.key === selection.key);
    const detail = finding && document.getElementById(finding.anchor) as HTMLDetailsElement | null;
    if (detail) {
      detail.open = true;
      const summary = detail.querySelector("summary");
      summary?.scrollIntoView?.({ block: "center" });
      summary?.focus({ preventScroll: true });
    }
  }, [selection, model]);
  const domains = t.report.priorityCards.domains as Record<string, string>;
  const visibleCount = model.findings.filter(finding => (domain === "all" || finding.domain === domain) && (effectiveFilter === "all" || finding.issue.severity === effectiveFilter)).length;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",       label: ti.filterAll },
    { key: "critical",  label: ti.filterCritical },
    { key: "important", label: ti.filterImportant },
    { key: "info",      label: ti.filterInfo },
  ];

  return (
    <section className={s.section}>
      {/* Header */}
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>{ti.title}</h2>
        <p className={s.sectionDesc}>{ti.desc}</p>
      </div>

      {/* Sticky filter bar */}
      <div className={s.filterBar}>
        {onFilterChange && <div className={s.domainFilter}><label htmlFor="report-domain-filter">{copy.domain}</label>
          <select id="report-domain-filter" value={domain} onChange={event => onFilterChange(event.target.value, effectiveFilter)}>
            <option value="all">{copy.allDomains}</option>
            {model.groups.map(group => <option key={group.key} value={group.key}>{domains[group.key] ?? ti.unknownDomain}</option>)}
          </select>
        </div>}
        <span className={s.filterLabel}>{ti.filterLabel} :</span>
        <div role="group" aria-label={ti.filterLabel} className={s.severityFilters}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`${s.filterBtn} ${effectiveFilter === key ? s.active : ""}`}
            aria-pressed={effectiveFilter === key}
            onClick={() => onFilterChange ? onFilterChange(domain, key) : setFilter(key)}
          >
            {label}
          </button>
        ))}</div>
      </div>

      <div className={s.resultsBar}>
        <p className={s.resultCount} role="status">{(visibleCount === 1 ? ti.resultCountOne : ti.resultCount).replace("{n}", String(visibleCount)).replace("{total}", String(model.counts.total))}</p>
        {visibleCount === 0 && model.counts.total > 0 && onFilterChange && <button className={s.filterBtn} type="button" onClick={() => onFilterChange("all", "all")}>{copy.clear}</button>}
      </div>

      {/* Categories */}
      {model.groups.filter(group => (domain === "all" || group.key === domain) && (group.key !== "unknown" || group.findings.length > 0)).map((cat) => {
        const issues = cat.findings.filter(finding => effectiveFilter === "all" || finding.issue.severity === effectiveFilter)
          .slice().sort((a, b) => sevWeight(a.issue.severity) - sevWeight(b.issue.severity) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        const sc = domainScore(cat.score?.score, cat.key, report.scores.coverage);
        const chip = sc === undefined ? {fg: "var(--argos-text-muted)", bg: "var(--argos-surface-2)"} : scoreChipTheme(sc / 100);

        return (
          <div key={cat.key} id={`cat-${cat.key}`} className={s.catBlock}>
            <div className={s.catHeader}>
              <div className={s.catMeta}>
                <p className={s.catLabel}>{domains[cat.key] ?? ti.unknownDomain}</p>
                <p className={s.catDesc}>{catInfo[cat.key] ?? catInfo.fallback}</p>
                <p className={s.catInfo}>
                  {issues.length} {issues.length === 1 ? ti.issueCountOne : ti.issueCount}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  className={s.catScoreChip}
                  style={{ color: chip.fg, background: chip.bg }}
                >
                  {sc === undefined ? decisionCopy[lang].notEvaluated : `${sc}${ti.scoreSuffix}`}
                </span>
                <a href="#top" className={s.backTop}>{ti.backToTop}</a>
              </div>
            </div>

            <div className={s.issueList}>
              {issues.length === 0 ? (
                <p className={s.noIssues}>{ti.noIssues}</p>
              ) : (
                issues.map((finding) => {
                  const { issue } = finding;
                  const content = findingContent(issue, lang);
                  const source = cleanEvidence(issue.structuredEvidence?.source || finding.sources.join(", "));
                  return (
                    <details key={finding.key} open={finding.key === initialOpenKey || undefined} id={finding.anchor} className={s.issueRow}>
                      <summary className={s.issueSummary}>
                        <span className={s.issueHeading}>
                          <span className={s.issueTags}>
                            <span className={s.sevTag} data-severity={issue.severity}>
                              {ti.severity[issue.severity as SevKey] ?? issue.severity}
                            </span>
                            <span>{domains[finding.domain] ?? ti.unknownDomain}</span>
                            {issue.effort && (
                              <span className={s.effortTag}>{ti.effortLabel} {issue.effort}</span>
                            )}
                            {source && <span>{source}</span>}
                          </span>
                          <span className={s.issueTitle}>{content.title}</span>
                          <span className={s.issueImpact}>{content.impact}</span>
                          <span className={s.issueQualification}>{content.qualification}
                            {(!issue.confidence || issue.confidence === "UNKNOWN") && ` · ${copy.unknownConfidence}`}
                          </span>
                        </span>
                        <span className={s.chevron} aria-hidden="true">▾</span>
                      </summary>

                      <FindingDetails finding={finding} />
                      <div className={s.issueFooter}>
                        <span>{copy.findingQuestions.severityProvenance}</span>
                        {issue.id && <ReportFeedback findingKey={issue.id} />}
                      </div>
                    </details>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
