import React from "react";
import { scoreColor } from "./reportColors";

type ScoreRingProps = {
  /** Score 0..100 : pilote le taux de remplissage de l'anneau. */
  score: number;
  /** Côté du SVG (px). Défaut 140. */
  size?: number;
  /** Épaisseur du trait. Défaut 10. */
  strokeWidth?: number;
  /** Rayon explicite ; défaut `(size - strokeWidth) / 2`. */
  radius?: number;
  /** Couleur de l'arc ; défaut {@link scoreColor}(score). */
  color?: string;
  /** Couleur de la piste (fond de l'anneau). */
  trackColor?: string;
  /** Libellé accessible ; défaut « Score {score}/100 ». */
  ariaLabel?: string;
  /** Contenu SVG centré (texte du score, propre à chaque usage). */
  children?: React.ReactNode;
};

/**
 * Anneau de score SVG partagé (issue #193) — factorise la géométrie
 * (circonférence + `stroke-dasharray`) auparavant dupliquée entre le hero du
 * rapport et la landing (source du bug de remplissage #168). Le texte central
 * reste fourni par l'appelant via `children`, chaque contexte gardant son rendu.
 */
export default function ScoreRing({
  score,
  size = 140,
  strokeWidth = 10,
  radius,
  color,
  trackColor = "rgba(255,255,255,0.08)",
  ariaLabel,
  children,
}: ScoreRingProps) {
  const r = radius ?? (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, score / 100)) * circ;
  const arc = color ?? scoreColor(score);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={ariaLabel ?? `Score ${score}/100`}>
      {/* Piste */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {/* Arc de remplissage : gap = circ - dash pour que le motif boucle (cf. #168). */}
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={arc} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      {children}
    </svg>
  );
}
