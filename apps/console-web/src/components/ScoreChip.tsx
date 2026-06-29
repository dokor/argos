"use client";

import React from "react";
import styles from "./ScoreChip.module.scss";
import { formatPct } from "@/lib/auditTypes";

function scoreTheme(ratio: number) {
  const r = Math.max(0, Math.min(1, ratio ?? 0));
  if (r >= 0.8) return { bg: "#dcfce7", fg: "#14532d", border: "#86efac", dot: "#16a34a" };
  if (r >= 0.6) return { bg: "#e0f2fe", fg: "#075985", border: "#bae6fd", dot: "#0284c7" };
  if (r >= 0.4) return { bg: "#fef9c3", fg: "#713f12", border: "#fde68a", dot: "#d97706" };
  return          { bg: "#fee2e2", fg: "#7f1d1d", border: "#fecaca", dot: "#dc2626" };
}

type ChipProps = {
  label: string;
  ratio: number;
  title?: string;
  active?: boolean;
  onClick?: () => void;
};

export function ScoreChip({ label, ratio, title, active = false, onClick }: ChipProps) {
  const r = Math.max(0, Math.min(1, ratio ?? 0));
  const { bg, fg, border } = scoreTheme(r);
  return (
    <div
      title={title}
      onClick={onClick}
      className={`${styles.chip} ${onClick ? styles["chip--clickable"] : ""}`}
      style={{
        border: active ? "2px solid " + fg : "1px solid " + border,
        background: active ? fg : bg,
        color: active ? "#fff" : fg,
      }}
    >
      <span>{label}</span>
      <span className={styles.pct}>{formatPct(r)}</span>
    </div>
  );
}

type BubblesProps = { ratio: number };

export function ScoreBubbles({ ratio }: BubblesProps) {
  const r = Math.max(0, Math.min(1, ratio ?? 0));
  const filled = Math.round(r * 5);
  const { dot } = scoreTheme(r);
  return (
    <div className={styles.bubbles}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={styles.bubble}
          style={{ background: i < filled ? dot : "#e2e8f0" }}
        />
      ))}
    </div>
  );
}