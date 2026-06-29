"use client";

import React, { useState, useMemo } from "react";
import AuditForm from "@/components/AuditForm";
import AuditList from "@/components/AuditList";
import LangToggle from "@/components/LangToggle";
import KpiCard from "@/components/KpiCard";
import { useLang } from "@/lib/i18n/LangContext";
import { AuditListItem } from "@/lib/ArgosApi";
import { getGlobalScore } from "@/lib/auditTypes";
import styles from "./page.module.css";

function scoreColors(score: number | null): { accent: string; bg: string } {
  if (score === null) return { accent: "#64748b", bg: "#f1f5f9" };
  if (score >= 80)    return { accent: "#16a34a", bg: "#dcfce7" };
  if (score >= 60)    return { accent: "#0284c7", bg: "#e0f2fe" };
  if (score >= 40)    return { accent: "#d97706", bg: "#fef9c3" };
  return               { accent: "#dc2626", bg: "#fee2e2" };
}

export default function DashboardPage() {
  const { t } = useLang();
  const [items, setItems] = useState<AuditListItem[]>([]);

  function onCreated(newItem: AuditListItem) {
    setItems((prev) => {
      const filtered = prev.filter((x) => x.runId !== newItem.runId);
      return [newItem, ...filtered];
    });
  }

  const stats = useMemo(() => {
    const analyzed   = items.filter((i) => i.status === "COMPLETED").length;
    const inProgress = items.filter((i) => i.status === "QUEUED" || i.status === "RUNNING").length;
    const errors     = items.filter((i) => i.status === "FAILED").length;

    const scores = items
      .filter((i) => i.status === "COMPLETED")
      .map((i) => getGlobalScore(i.resultJson))
      .filter((s): s is number => s !== null);

    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    return { analyzed, inProgress, errors, avgScore };
  }, [items]);

  const td = t.dashboard;
  const { accent: scoreAccent, bg: scoreBg } = scoreColors(stats.avgScore);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>A</span>
            <span className={styles.logoName}>Argos</span>
            <span className={styles.logoBadge}>Console</span>
          </div>
          <LangToggle />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.kpiGrid}>
          <KpiCard label={td.stats.analyzed}   value={stats.analyzed}   icon="✓" accent="#16a34a" bg="#dcfce7" description={td.stats.analyzedDesc} />
          <KpiCard label={td.stats.inProgress} value={stats.inProgress} icon="↻" accent="#0284c7" bg="#e0f2fe" description={td.stats.inProgressDesc} highlight={stats.inProgress > 0} />
          <KpiCard label={td.stats.errors}     value={stats.errors}     icon="✗" accent="#dc2626" bg="#fee2e2" description={td.stats.errorsDesc}     highlight={stats.errors > 0} />
          <KpiCard label={td.stats.avgScore}   value={stats.avgScore !== null ? stats.avgScore + "%" : "—"} icon="◎" accent={scoreAccent} bg={scoreBg} description={td.stats.avgScoreDesc} />
        </div>

        <div className={styles.formSection}>
          <div className={styles.sectionLabel}>{td.newAudit}</div>
          <AuditForm onCreated={onCreated} />
        </div>

        <AuditList items={items} setItems={setItems} />
      </main>
    </div>
  );
}
