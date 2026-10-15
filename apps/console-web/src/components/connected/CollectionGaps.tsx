"use client";
import { useLang } from "@/lib/i18n/LangContext";
import type { PageResult } from "@/lib/connected/contracts";
import s from "./CollectionGaps.module.scss";
const copy = {
  fr: { partial: "Collecte partielle", failed: "Échec de l’exécution", canceled: "Analyse annulée", none: "Aucune mesure disponible", unknown: "Cause de l’incomplétude non précisée", unavailable: "Rapport indisponible ou expiré", modules: "Modules avec des mesures manquantes", checks: "Contrôles non mesurés", repeated: "Indisponibilités répétées parmi les pages affichées", shared: "La même indisponibilité est observée sur plusieurs pages ; cela ne prouve pas une cause commune.", shown: "pages affichées", unknownReason: "Motif non précisé" },
  en: { partial: "Partial collection", failed: "Execution failed", canceled: "Analysis canceled", none: "No measurements available", unknown: "Reason for incompleteness not specified", unavailable: "Report unavailable or expired", modules: "Modules with missing measurements", checks: "Unmeasured checks", repeated: "Repeated unavailability among displayed pages", shared: "The same unavailability is observed on several pages; this does not prove a common cause.", shown: "displayed pages", unknownReason: "Reason not specified" },
};
function missingModules(page: PageResult) {
  return [...new Set([...Object.entries(page.moduleStatuses).filter(([, status]) => status === "FAILED" || status === "SKIPPED").map(([id]) => id), ...(page.collectionGaps ?? []).map(g => g.module).filter(id => id !== "unknown")])].filter(id => /^[a-z0-9_-]{1,32}$/.test(id)).sort();
}
function reason(code: string, lang: "fr" | "en") {
  const labels: Record<string, [string, string]> = {
    TIMEOUT: ["Délai de collecte dépassé", "Collection timed out"],
    MODULE_TIMEOUT: ["Délai du module dépassé", "Module timed out"],
    BLOCKED_BY_ANTIBOT: ["Collecte bloquée par une protection anti-bot", "Collection blocked by an anti-bot protection"],
    ANTIBOT: ["Collecte bloquée par une protection anti-bot", "Collection blocked by an anti-bot protection"],
    CHECK_MISSING: ["Contrôle non collecté", "Check not collected"],
    MODULE_UNAVAILABLE: ["Module indisponible", "Module unavailable"],
    UNAVAILABLE: ["Mesure indisponible", "Measurement unavailable"],
  };
  return labels[code]?.[lang === "fr" ? 0 : 1] ?? copy[lang].unknownReason;
}
export default function CollectionGaps({ page }: { page: PageResult }) {
  const { lang } = useLang(), c = copy[lang];
  const gaps = page.collectionGaps ?? [], modules = missingModules(page);
  const state = page.executionStatus === "FAILED" ? c.failed : page.executionStatus === "CANCELED" ? c.canceled
    : page.executionStatus !== "COMPLETED" ? null : !page.reportAvailable ? c.unavailable
    : page.completeness === "NONE" || page.coverage.ratio === 0 ? c.none : page.completeness === "PARTIAL" ? c.partial : page.completeness === "UNKNOWN" ? c.unknown : null;
  const reasons = [...new Set([...(page.failureReason ? [reason(page.failureReason,lang)] : []), ...gaps.map(gap => reason(gap.reason,lang))])].filter(text => text !== c.unknownReason);
  if (!state && !gaps.length && !modules.length) return null;
  return <div className={s.gaps}>
    {state && <p>{state}</p>}
    {!!reasons.length && <p>{reasons.join(" · ")}</p>}
    {!!modules.length && <p>{c.modules}: {modules.join(", ")}</p>}
    {!!gaps.length && <details><summary>{c.checks} ({gaps.length})</summary><ul>{gaps.map((gap,i) => <li key={i}><code>{gap.ruleKey}</code> · {reason(gap.reason,lang)}</li>)}</ul></details>}
  </div>;
}
export function RepeatedCollectionGaps({ pages }: { pages: readonly PageResult[] }) {
  const { lang } = useLang(), c = copy[lang];
  const counts = new Map<string,number>();
  for (const page of pages) for (const collectorId of missingModules(page)) counts.set(collectorId,(counts.get(collectorId) ?? 0)+1);
  const repeated = [...counts].filter(([,count]) => count > 1).sort(([a],[b]) => a.localeCompare(b));
  return repeated.length ? <div className={s.repeated}><h3>{c.repeated}</h3><ul>{repeated.map(([module,count]) => <li key={module}>{module}: {count} / {pages.length} {c.shown}</li>)}</ul><p>{c.shared}</p></div> : null;
}
