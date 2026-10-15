"use client";

import type { Coverage } from "@/components/report/types";
import { collectorReason } from "@/lib/collector-reason";
import { useLang } from "@/lib/i18n/LangContext";

type Props = {
  modules: Record<string, string>;
  coverage?: Coverage | null;
  loading?: boolean;
  unavailable?: boolean;
};

export default function CollectorDiagnostics({ modules, coverage, loading = false, unavailable = false }: Props) {
  const { lang } = useLang();
  const failed = Object.entries(modules).filter(([, state]) => ["FAILED", "TIMEOUT", "SKIPPED"].includes(state));
  if (!failed.length) return null;
  const title = lang === "fr" ? "Causes de collecte" : "Collection causes";
  const fallback = loading
    ? (lang === "fr" ? "Lecture du rapport…" : "Reading report…")
    : unavailable
      ? (lang === "fr" ? "Rapport indisponible : le motif ne peut pas être vérifié." : "Report unavailable: the reason cannot be verified.")
      : (lang === "fr" ? "Motif non enregistré dans ce rapport. Consulter les diagnostics internes corrélés à cette analyse." : "Reason not recorded in this report. Inspect internal diagnostics correlated with this analysis.");
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <p>{lang === "fr"
        ? "Une mesure absente ne valide pas la sécurité de la cible. Les motifs ci-dessous proviennent de ce rapport, pas de la configuration actuelle."
        : "Missing measurements do not validate target security. Reasons below come from this report, not current configuration."}</p>
      <ul>{failed.map(([module]) => {
        const reasons = [...new Set((coverage?.checks ?? [])
          .filter(check => check.module === module && check.state !== "MEASURED" && check.state !== "NOT_APPLICABLE")
          .map(check => collectorReason(check.reason ?? "", lang))
          .filter((reason): reason is string => !!reason))];
        return <li key={module}><strong>{module}</strong>: {reasons.length ? reasons.join(" · ") : fallback}</li>;
      })}</ul>
    </section>
  );
}
