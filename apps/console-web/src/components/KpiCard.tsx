"use client";

import React from "react";
import styles from "./KpiCard.module.scss";

type Props = {
  label: string;
  value: number | string;
  icon: string;
  accent: string;
  bg: string;
  description?: string;
  highlight?: boolean;
};

export default function KpiCard({ label, value, icon, accent, bg, description, highlight = false }: Props) {
  return (
    <div
      className={styles.card}
      style={{
        "--card-border": highlight ? accent + "55" : "#e2e8f0",
        "--card-shadow": highlight ? "0 0 0 3px " + accent + "18" : "0 1px 3px rgba(15,23,42,0.04)",
      } as React.CSSProperties}
    >
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span
          className={styles.icon}
          style={{ "--icon-bg": bg, "--icon-color": accent } as React.CSSProperties}
        >
          {icon}
        </span>
      </div>
      <div className={styles.value}>{value}</div>
      {description && <div className={styles.description}>{description}</div>}
    </div>
  );
}
