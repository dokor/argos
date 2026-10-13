"use client";

import { PriorityItem } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { SEVERITY_COLORS } from "./reportColors";
import type { ReportModel } from "./reportModel";
import s from "./PriorityCards.module.scss";
import { cleanEvidence, findingContent } from "./findingCatalogue";
import { isAggregateFinding } from "./findingPresentation";
import { interpretationCopy } from "./reportInterpretation";

type SevKey = "critical" | "important" | "opportunity";

export default function PriorityCards({ priorities, model, onSelectFinding, limit = 6 }: { priorities: PriorityItem[]; model?: ReportModel; onSelectFinding?: (key: string) => void; limit?: number }) {
  const { t, lang } = useLang();
  const tp = t.report.priorityCards;
  const list = (priorities || []).slice(0, limit);

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>{tp.title}</h2>
        <p className={s.sectionDesc}>{interpretationCopy[lang].actions}</p>
      </div>

      {list.length === 0 ? (
        <p className={s.empty}>{tp.empty}</p>
      ) : (
        <ol className={s.grid}>
          {list.map((p, i) => {
            const resolution = model?.priorities[i];
            const grouped = new Set([p.findingKey, ...(p.relatedFindingKeys ?? [])].filter(Boolean)).size > 1;
            const content = !grouped && resolution?.findings.length === 1 ? findingContent(resolution.findings[0].issue, lang) : undefined;
            const sources = [...new Set([...(p.sources ?? []), ...(resolution?.findings.flatMap(finding => finding.sources) ?? [])])];
            const domain = p.categoryKey ?? resolution?.findings[0]?.domain;
            const sev = SEVERITY_COLORS[p.severity as SevKey] ?? SEVERITY_COLORS.opportunity;
            return (
              <li
                key={`${p.findingKey ?? "priority"}-${i}`}
                className={s.card}
                style={{ ["--accent" as string]: sev.color }}
              >
                <p className={s.rank}>{tp.rankLabel} {Number.isInteger(p.rank) && p.rank! > 0 ? p.rank : i + 1}</p>

                <div className={s.cardTop}>
                  <span
                    className={s.severityBadge}
                    style={{ color: sev.color, background: sev.bg }}
                  >
                    {tp.severity[p.severity as SevKey] ?? p.severity}
                  </span>
                  {(
                    <span className={s.effortBadge}>
                      {tp.effortLabel} {p.effort ?? tp.effortUnknown}
                    </span>
                  )}
                </div>

                <h3 className={s.cardTitle}>{content?.title ?? cleanEvidence(p.title)}</h3>
                <p className={s.cardImpact}>{content?.impact ?? cleanEvidence(p.impact)}</p>
                {content && <><p>{content.qualification}</p><p>{content.recommendation}</p></>}
                {isAggregateFinding(p.findingKey) && <p>{lang === "fr" ? "Cette note d’outil n’est pas une correction à chiffrer. Examiner les constats détaillés du même outil ci-dessous ; sans eux, demander le diagnostic source." : "This tool score is not an estimable correction. Inspect the detailed findings from the same tool below; without them, request the source diagnosis."}</p>}
                <details className={s.explanation}><summary>{lang === "fr" ? "Sources et confiance de mesure" : "Sources and measurement confidence"}</summary><div className={s.metadata}>
                  <p>{domain ? (tp.domains as Record<string, string>)[domain] ?? tp.unknownDomain : tp.unknownDomain}</p>
                  <p>{tp.sourcesLabel} : {sources.map(cleanEvidence).join(", ") || "—"}</p>
                  <p>{tp.confidenceLabel} {p.confidence && Object.hasOwn(tp.confidence, p.confidence) ? tp.confidence[p.confidence] : tp.confidence.UNKNOWN}</p>
                </div></details>
                {p.rankReason && (
                  <details className={s.explanation}>
                    <summary>{tp.rankingDetails}</summary>
                    <p>{tp.rankReasons[p.rankReason]}</p>
                    {p.rankReason === "MODELLED_SCORE_GAIN" && typeof p.globalScoreGain === "number" && Number.isFinite(p.globalScoreGain) && (
                      <p>{tp.gainLabel} {p.globalScoreGain.toLocaleString(lang === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 2 })} {tp.gainUnit}</p>
                    )}
                    <p className={s.modelLimit}>{tp.modelLimit}</p>
                  </details>
                )}
                {grouped && <p>{tp.groupedLabel} {resolution ? resolution.findings.length : new Set([p.findingKey, ...(p.relatedFindingKeys ?? [])].filter(Boolean)).size}</p>}
                {resolution && (
                  <div className={s.findingLinks}>
                    {[...resolution.findings, ...(isAggregateFinding(p.findingKey) ? model?.findings.filter(f => !isAggregateFinding(f.key) && f.domain === domain && f.key.startsWith(p.findingKey!.split(".")[0] + ".") && !resolution.findings.some(r => r.key === f.key)) ?? [] : [])].map(finding => (
                      <a key={finding.key} href={`#${finding.anchor}`} aria-label={`${tp.seeFinding}: ${findingContent(finding.issue, lang).title}`} onClick={event => {
                        if (onSelectFinding) {
                          event.preventDefault();
                          onSelectFinding(finding.key);
                        }
                      }}>{tp.seeFinding}</a>
                    ))}
                    {resolution.status !== "resolved" && <p>{resolution.status === "partial" ? tp.partialFindings : tp.missingFinding}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
