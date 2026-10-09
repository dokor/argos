"use client";

import { buildReportModel, ReportModel } from "./reportModel";
import { Report, TechSummary } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { scoreColor, scoreBg, SEVERITY_COLORS } from "./reportColors";
import ScoreRing from "./ScoreRing";
import MeasurementCoverage from "./MeasurementCoverage";
import RelaunchButton from "./RelaunchButton";
import s from "./ReportHero.module.scss";
import { reportReadingCopy } from "./reportReadingCopy";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreGradient(score: number): string {
  const c = scoreColor(score);
  return `linear-gradient(90deg, ${c} 0%, ${c}88 100%)`;
}

function getInitial(domain: string): string {
  return (domain || "?").replace(/^www\./, "")[0]?.toUpperCase() ?? "?";
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function techLabels(tech?: TechSummary): string[] {
  if (!tech) return [];
  const labels: string[] = [];
  if (tech.cms?.name) labels.push(tech.cms.name);
  if (tech.nextJs?.isNext) {
    const router = tech.nextJs.router === "app" ? "App Router" : tech.nextJs.router === "pages" ? "Pages Router" : "";
    labels.push(router ? `Next.js · ${router}` : "Next.js");
  } else if (tech.frontendFramework?.name && tech.frontendFramework.name !== "unknown") {
    labels.push(tech.frontendFramework.name);
  }
  return labels;
}

// ─── Severity counts ──────────────────────────────────────────────────────────

const SEV_CONFIG = [
  { key: "critical",    color: SEVERITY_COLORS.critical.dot },
  { key: "important",   color: SEVERITY_COLORS.important.dot },
  { key: "opportunity", color: SEVERITY_COLORS.opportunity.dot },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportHero({ report, model = buildReportModel(report) }: { report: Report; model?: ReportModel }) {
  const { t, lang } = useLang();
  const th = t.report.hero;

  const score = Math.max(0, Math.min(100, report.scores.global));
  const available = report.scores.globalAvailable !== false;
  const color = scoreColor(score);
  const issuesCount = model.counts.total;
  const counts = model.counts;

  const techs = techLabels(report.tech);
  const domainRating = report.site?.domainRating;
  const hasDomainRating = domainRating != null && Number.isFinite(domainRating.score)
    && domainRating.score >= 0 && domainRating.score <= 100;
  const scoreUiLabel =
    score >= 85 ? th.scoreLabels.excellent :
    score >= 70 ? th.scoreLabels.good :
    score >= 55 ? th.scoreLabels.improve :
    th.scoreLabels.priority;

  return (
    <section className={s.hero}>
      {/* Dynamic accent bar */}
      <div className={s.accentBar} style={{ background: available ? scoreGradient(score) : "var(--argos-border)" }} />

      <div className={s.heroInner}>
        <div className={s.topRow}>
          {/* Identity */}
          <div className={s.identity}>
            <div className={s.avatar}>
              {report.site?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={report.site.logoUrl} alt="" />
              ) : (
                getInitial(report.domain)
              )}
            </div>

            <h1 className={s.siteName}>{report.site?.title || report.domain}</h1>

            <div className={s.meta}>
              <span className={s.metaText}>{report.domain}</span>
              <span className={s.metaText}>·</span>
              <span className={s.metaText}>{th.analyzedAt} {formatDate(report.generatedAt, th.locale)}</span>
              {techs.map((tl) => (
                <span key={tl} className={s.techPill}>{tl}</span>
              ))}
              {hasDomainRating && (
                <span className={s.domainRating} title={th.domainRatingTooltip}>
                  <strong>DR {Math.round(domainRating.score)}/100</strong>
                  <span>· {th.domainRatingFetchedAt} <time dateTime={domainRating.fetchedAt}>
                    {formatDate(domainRating.fetchedAt, th.locale)}
                  </time></span>
                  <a href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer">
                    Domain Rating by Ahrefs
                  </a>
                </span>
              )}
            </div>

            {available && !report.scores.coverage?.provisional && report.summary?.oneLiner && (
              <p className={s.oneLiner}>
                {(th.oneLiner as Record<string, string>)[report.summary.oneLiner] ?? report.summary.oneLiner}
              </p>
            )}
          </div>

          {/* Score ring */}
          <div className={s.scoreBlock}>
            <p>{reportReadingCopy[lang].score}</p>
            {available ? <ScoreRing score={score}>
              <text x={70} y={64} textAnchor="middle" fontSize={38} fontWeight={800} className={s.ringScore} fontFamily="Inter,system-ui,sans-serif">
                {score}
              </text>
              <text x={70} y={86} textAnchor="middle" fontSize={13} className={s.ringUnit} fontFamily="Inter,system-ui,sans-serif">
                /100
              </text>
            </ScoreRing> : <p className={s.scoreLabel}>{th.scoreUnavailable}</p>}
            {available && (
            <span
              className={s.scoreLabel}
              style={{ color, background: scoreBg(score) }}
            >
              {report.scores.coverage?.provisional ? t.report.measurementCoverage.provisional : scoreUiLabel}
            </span>
            )}
            <RelaunchButton url={report.url} />
          </div>
        </div>

        <MeasurementCoverage coverage={report.scores.coverage} />
        {/* Stats bar */}
        <div className={s.statsRow}>
          {SEV_CONFIG.map(({ key, color: c }) => (
            <div key={key} className={s.stat}>
              <div className={s.statValue} style={{ color: c }}>
                {counts[key]}
              </div>
              <div className={s.statLabel}>{th.severity[key]}</div>
            </div>
          ))}
          <div className={s.stat}>
            <div className={`${s.statValue} ${s.statTotalValue}`}>
              {issuesCount}
            </div>
            <div className={s.statLabel}>{th.issues}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
