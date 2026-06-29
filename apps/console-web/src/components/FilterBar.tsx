"use client";

import React from "react";
import styles from "./FilterBar.module.scss";
import { AuditListItem } from "@/lib/ArgosApi";
import { SortKey } from "@/lib/auditTypes";

type Translations = {
  filters: {
    statusLabel: string;
    all: string;
    sortLabel: string;
    sortDateDesc: string;
    sortDateAsc: string;
    sortScoreDesc: string;
    sortScoreAsc: string;
    moduleLabel: string;
    tagLabel: string;
    techLabel: string;
    clearFilters: string;
  };
  status: Record<string, string>;
};

type Props = {
  tl: Translations;
  statusCounts: Record<string, number>;
  allModules: string[];
  allTags: string[];
  allTechs: string[];
  sortBy: SortKey;
  filterStatus: string;
  filterModule: string;
  filterTag: string;
  filterTech: string;
  hasActiveFilters: boolean;
  setSortBy: (v: SortKey) => void;
  setFilterStatus: (v: string) => void;
  setFilterModule: (v: string) => void;
  setFilterTag: (v: string) => void;
  setFilterTech: (v: string) => void;
  clearFilters: () => void;
};

const STATUS_KEYS: Array<AuditListItem["status"] | "ALL"> = [
  "ALL", "QUEUED", "RUNNING", "COMPLETED", "FAILED",
];

export default function FilterBar({
  tl, statusCounts,
  allModules, allTags, allTechs,
  sortBy, filterStatus, filterModule, filterTag, filterTech,
  hasActiveFilters,
  setSortBy, setFilterStatus, setFilterModule, setFilterTag, setFilterTech,
  clearFilters,
}: Props) {
  return (
    <div className={styles.bar}>
      {/* Status chips */}
      <div className={styles.row}>
        <span className={styles.groupLabel}>{tl.filters.statusLabel}</span>
        {STATUS_KEYS.map((s) => {
          const count = statusCounts[s] ?? 0;
          if (s !== "ALL" && count === 0) return null;
          const active = filterStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={styles.chip}
              style={{
                background: active ? "#0f172a" : "#f8fafc",
                color: active ? "#ffffff" : "#475569",
                border: active ? "1px solid #0f172a" : "1px solid #e2e8f0",
                fontWeight: active ? 800 : 600,
              }}
            >
              {s === "ALL" ? tl.filters.all : tl.status[s]}
              <span className={styles.chipCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Dropdowns */}
      <div className={styles.row}>
        <SelectBox label={tl.filters.sortLabel}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className={styles.select}>
            <option value="date_desc">{tl.filters.sortDateDesc}</option>
            <option value="date_asc">{tl.filters.sortDateAsc}</option>
            <option value="score_desc">{tl.filters.sortScoreDesc}</option>
            <option value="score_asc">{tl.filters.sortScoreAsc}</option>
          </select>
        </SelectBox>

        {allModules.length > 0 && (
          <SelectBox label={tl.filters.moduleLabel}>
            <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className={styles.select}>
              <option value="ALL">{tl.filters.all}</option>
              {allModules.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </SelectBox>
        )}

        {allTags.length > 0 && (
          <SelectBox label={tl.filters.tagLabel}>
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className={styles.select}>
              <option value="ALL">{tl.filters.all}</option>
              {allTags.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
            </select>
          </SelectBox>
        )}

        {allTechs.length > 0 && (
          <SelectBox label={tl.filters.techLabel}>
            <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className={styles.select}>
              <option value="ALL">{tl.filters.all}</option>
              {allTechs.map((tc) => <option key={tc} value={tc}>{tc}</option>)}
            </select>
          </SelectBox>
        )}

        {hasActiveFilters && (
          <button onClick={clearFilters} className={styles.clearBtn}>
            × {tl.filters.clearFilters}
          </button>
        )}
      </div>
    </div>
  );
}

function SelectBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.selectBox}>
      <span className={styles.selectLabel}>{label}</span>
      {children}
    </div>
  );
}
