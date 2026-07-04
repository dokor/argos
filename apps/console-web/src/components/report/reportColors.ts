// ─── Système de couleurs des rapports (issue #121) ────────────────────────────
//
// Source unique de vérité pour les couleurs de score et de sévérité affichées
// dans les composants de rapport. Auparavant, la fonction `scoreColor` était
// dupliquée à l'identique dans ScoreGrid, IssuesByCategory et ReportHero, et les
// maps de sévérité (couleur/fond/pastille) étaient recopiées dans IssuesByCategory,
// PriorityCards et ReportHero, avec des valeurs hex codées en dur.
//
// Centraliser ici élimine la duplication et fournit le point d'ancrage sémantique
// pour un futur passage en tokens CSS / dark mode (cf. #81) - sans changer les
// couleurs actuelles.

/** Couleur d'un score 0..100, en 4 bandes (excellent / bon / moyen / faible). */
export function scoreColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#3b82f6";
  if (score >= 55) return "#f59e0b";
  return "#ef4444";
}

/** Fond translucide correspondant à {@link scoreColor} (bandeau de score). */
export function scoreBg(score: number): string {
  if (score >= 85) return "rgba(16,185,129,0.15)";
  if (score >= 70) return "rgba(59,130,246,0.15)";
  if (score >= 55) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

export type SeverityKey = "critical" | "important" | "info" | "opportunity";

export type SeverityColor = {
  /** Couleur de texte / badge. */
  color: string;
  /** Fond de badge. */
  bg: string;
  /** Pastille / accent. */
  dot: string;
};

/**
 * Couleurs par sévérité. Superset couvrant les trois usages historiques :
 * texte/badge (`color`), fond (`bg`) et pastille/accent (`dot`).
 * Les clés `info` et `opportunity` partagent la même sémantique d'affichage
 * (le backend renvoie `info`, l'UI l'affiche parfois comme « opportunité »).
 */
export const SEVERITY_COLORS: Record<SeverityKey, SeverityColor> = {
  critical:    { color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" },
  important:   { color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  info:        { color: "#64748b", bg: "#f8fafc", dot: "#94a3b8" },
  opportunity: { color: "#059669", bg: "#f0fdf4", dot: "#10b981" },
};
