export const compactCopy = {
  fr: { details: "Détails de la mesure", corrections: "Voir les corrections", coverage: "Compléter la couverture", quota: "Consulter les quotas", recent: "Dernier diagnostic", history: "Tous mes sites et historiques", scope: "Conditions et limites de découverte", affected: "pages affectées", evaluated: "évaluées", examples: "Exemples", metadata: "Métadonnées" },
  en: { details: "Measurement details", corrections: "View findings", coverage: "Complete coverage", quota: "View quota", recent: "Latest diagnosis", history: "All sites and history", scope: "Discovery conditions and limits", affected: "affected pages", evaluated: "evaluated", examples: "Examples", metadata: "Metadata" },
};

/** Keep the exact path/query identity; omit the scheme only in the display label. */
export function compactUrl(raw: string, pathOnly = false) {
  try { const url = new URL(raw); return `${pathOnly ? "" : url.host}${url.pathname}${url.search}${url.hash}`; }
  catch { return raw; }
}
