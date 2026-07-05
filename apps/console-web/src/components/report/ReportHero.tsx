"use client";

import { Report, TechSummary } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { scoreColor, scoreBg, SEVERITY_COLORS } from "./reportColors";
import ScoreRing from "./ScoreRing";
import s from "./ReportHero.module.scss";

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

export default function ReportHero({ report }: { report: Report }) {
  const { t } = useLang();
  const th = t.report.hero;

  const score = Math.max(0, Math.min(100, report.scores.global));
  const color = scoreColor(score);
  const allIssues = report.issues ?? [];
  const issuesCount = allIssues.length;

  // Les compteurs de sévérité reflètent l'ensemble des issues détectées.
  // "info" côté backend est affiché comme "opportunity" dans l'UI.
  const counts = {
    critical:    allIssues.filter((i) => i.severity === "critical").length,
    important:   allIssues.filter((i) => i.severity === "important").length,
    opportunity: allIssues.filter((i) => i.severity === "info").length,
  };

  const techs = techLabels(report.tech);
  const scoreUiLabel =
    score >= 85 ? th.scoreLabels.excellent :
    score >= 70 ? th.scoreLabels.good :
    score >= 55 ? th.scoreLabels.improve :
    th.scoreLabels.priority;

  return (
    <section className={s.hero}>
      {/* Dynamic accent bar */}
      <div className={s.accentBar} style={{ background: scoreGradient(score) }} />

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
            </div>

            {report.summary?.oneLiner && (
              <p className={s.oneLiner}>
                {(th.oneLiner as Record<string, string>)[report.summary.oneLiner] ?? report.summary.oneLiner}
              </p>
            )}
          </div>

          {/* Score ring */}
          <div className={s.scoreBlock}>
            <ScoreRing score={score}>
              <text x={70} y={64} textAnchor="middle" fontSize={38} fontWeight={800} className={s.ringScore} fontFamily="Inter,system-ui,sans-serif">
                {score}
              </text>
              <text x={70} y={86} textAnchor="middle" fontSize={13} className={s.ringUnit} fontFamily="Inter,system-ui,sans-serif">
                /100
              </text>
            </ScoreRing>
            <span
              className={s.scoreLabel}
              style={{ color, background: scoreBg(score) }}
            >
              {scoreUiLabel}
            </span>
          </div>
        </div>

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
