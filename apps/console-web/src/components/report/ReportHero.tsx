"use client";

import { Report, PriorityItem, TechSummary } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ReportHero.module.scss";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#3b82f6";
  if (score >= 55) return "#f59e0b";
  return "#ef4444";
}

function scoreBg(score: number): string {
  if (score >= 85) return "rgba(16,185,129,0.15)";
  if (score >= 70) return "rgba(59,130,246,0.15)";
  if (score >= 55) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

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

// ─── Score ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size = 140;
  const strokeW = 10;
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, score / 100)) * circ;
  const color = scoreColor(score);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score ${score}/100`}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeW} />
      {/* Arc */}
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={strokeW}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={38} fontWeight={800} fill="#f8fafc" fontFamily="Inter,system-ui,sans-serif">
        {score}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={13} fill="#94a3b8" fontFamily="Inter,system-ui,sans-serif">
        /100
      </text>
    </svg>
  );
}

// ─── Severity counts ──────────────────────────────────────────────────────────

const SEV_CONFIG = [
  { key: "critical",    color: "#ef4444" },
  { key: "important",   color: "#f59e0b" },
  { key: "opportunity", color: "#10b981" },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportHero({ report }: { report: Report }) {
  const { t } = useLang();
  const th = t.report.hero;

  const score = Math.max(0, Math.min(100, report.scores.global));
  const color = scoreColor(score);
  const priorities: PriorityItem[] = report.summary?.priorities ?? [];
  const issuesCount = report.issues?.length ?? 0;

  const counts = {
    critical:    priorities.filter((p) => p.severity === "critical").length,
    important:   priorities.filter((p) => p.severity === "important").length,
    opportunity: priorities.filter((p) => p.severity === "opportunity").length,
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
              <p className={s.oneLiner}>{report.summary.oneLiner}</p>
            )}
          </div>

          {/* Score ring */}
          <div className={s.scoreBlock}>
            <ScoreRing score={score} />
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
            <div className={s.statValue} style={{ color: "#94a3b8" }}>
              {issuesCount}
            </div>
            <div className={s.statLabel}>{th.issues}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
