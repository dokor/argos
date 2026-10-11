"use client";

import React from "react";
import styles from "./ScoreChip.module.scss";
import { formatPct } from "@/lib/auditTypes";
import { scoreChipTheme } from "@/components/report/reportColors";

type ChipProps = {
  label: string;
  ratio: number;
  title?: string;
  active?: boolean;
  onClick?: () => void;
};

export function ScoreChip({ label, ratio, title, active = false, onClick }: ChipProps) {
  const r = Math.max(0, Math.min(1, ratio ?? 0));
  const { bg, fg, border } = scoreChipTheme(r);
  const content = <><span>{label}</span><span className={styles.pct}>{formatPct(r)}</span></>;
  const props = {
      title,
      className: `${styles.chip} ${onClick ? styles["chip--clickable"] : ""}`,
      style: {
        border: "1px solid " + (active ? "var(--argos-text)" : border),
        background: active ? "var(--argos-text)" : bg,
        color: active ? "var(--argos-bg)" : fg,
      },
  };
  return onClick ? <button type="button" aria-pressed={active} onClick={onClick} {...props}>{content}</button>
    : <div {...props}>{content}</div>;
}

type BubblesProps = { ratio: number };

export function ScoreBubbles({ ratio }: BubblesProps) {
  const r = Math.max(0, Math.min(1, ratio ?? 0));
  const filled = Math.round(r * 5);
  const { dot } = scoreChipTheme(r);
  return (
    <div className={styles.bubbles} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={styles.bubble}
          style={{ background: i < filled ? dot : "var(--argos-border)" }}
        />
      ))}
    </div>
  );
}
