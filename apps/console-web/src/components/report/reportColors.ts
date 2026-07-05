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

// ─── Échelle de score unifiée (issue #190) ────────────────────────────────────
//
// Source unique pour la correspondance score → couleur, partagée par le rapport,
// le dashboard et les chips. Auparavant trois barèmes divergeaient (seuils
// 85/70/55 vs 80/60/40 vs 0.8/0.6/0.4, palettes différentes). On unifie sur les
// seuils du rapport (85/70/55) et une seule famille de teintes par bande.

/** Thème complet d'une bande de score (accent + fonds/texte dérivés). */
export type ScoreBandTheme = {
  /** Couleur pleine (texte fort, anneau). */
  accent: string;
  /** Fond translucide (bandeau de score du rapport). */
  softBg: string;
  /** Fond clair solide (chip / carte KPI). */
  chipBg: string;
  /** Texte foncé lisible sur {@link chipBg}. */
  chipFg: string;
  /** Bordure de chip. */
  chipBorder: string;
  /** Pastille / accent secondaire. */
  dot: string;
};

// 4 bandes : excellent (≥85) / bon (≥70) / moyen (≥55) / faible (<55).
// `accent` et `softBg` reprennent à l'identique les valeurs historiques du rapport
// (aucun changement visuel du rapport) ; les tints de chip alignent dashboard et
// chips sur la même famille de couleur.
const SCORE_BANDS: readonly ScoreBandTheme[] = [
  { accent: "#10b981", softBg: "rgba(16,185,129,0.15)", chipBg: "#dcfce7", chipFg: "#065f46", chipBorder: "#86efac", dot: "#10b981" },
  { accent: "#3b82f6", softBg: "rgba(59,130,246,0.15)", chipBg: "#dbeafe", chipFg: "#1e40af", chipBorder: "#93c5fd", dot: "#3b82f6" },
  { accent: "#f59e0b", softBg: "rgba(245,158,11,0.15)", chipBg: "#fef3c7", chipFg: "#92400e", chipBorder: "#fcd34d", dot: "#f59e0b" },
  { accent: "#ef4444", softBg: "rgba(239,68,68,0.15)",  chipBg: "#fee2e2", chipFg: "#991b1b", chipBorder: "#fca5a5", dot: "#ef4444" },
];

/** Bande de score (0..100) selon les seuils unifiés 85 / 70 / 55. */
function scoreBand(score: number): ScoreBandTheme {
  if (score >= 85) return SCORE_BANDS[0];
  if (score >= 70) return SCORE_BANDS[1];
  if (score >= 55) return SCORE_BANDS[2];
  return SCORE_BANDS[3];
}

/** Thème neutre (score absent). */
const NEUTRAL_SCORE_THEME = { accent: "#64748b", chipBg: "#f1f5f9" } as const;

/** Couleur d'un score 0..100, en 4 bandes (excellent / bon / moyen / faible). */
export function scoreColor(score: number): string {
  return scoreBand(score).accent;
}

/** Fond translucide correspondant à {@link scoreColor} (bandeau de score). */
export function scoreBg(score: number): string {
  return scoreBand(score).softBg;
}

/** Thème d'un chip/badge de score à partir d'un ratio 0..1 (chips, bulles). */
export function scoreChipTheme(ratio: number): { bg: string; fg: string; border: string; dot: string } {
  const band = scoreBand(Math.max(0, Math.min(1, ratio ?? 0)) * 100);
  return { bg: band.chipBg, fg: band.chipFg, border: band.chipBorder, dot: band.dot };
}

/** Thème d'une carte KPI de score 0..100 ({@code null} → neutre). */
export function scoreKpiTheme(score: number | null): { accent: string; bg: string } {
  if (score === null) return { accent: NEUTRAL_SCORE_THEME.accent, bg: NEUTRAL_SCORE_THEME.chipBg };
  const band = scoreBand(score);
  return { accent: band.accent, bg: band.chipBg };
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
