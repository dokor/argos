"use client";

import React, { useEffect, useMemo, useState } from "react";
import { argosApi, AuditListItem } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";
import {
  parseReport, extractTechs, prettyJson,
  AuditReportV2, SortKey,
} from "@/lib/auditTypes";
import FilterBar from "./FilterBar";
import AuditCard from "./AuditCard";
import styles from "./AuditList.module.scss";

type Props = {
  items: AuditListItem[];
  setItems: React.Dispatch<React.SetStateAction<AuditListItem[]>>;
};

function isFinal(status: AuditListItem["status"]) {
  return status === "COMPLETED" || status === "FAILED";
}

export default function AuditList({ items, setItems }: Props) {
  const { t } = useLang();
  const tl = t.auditList;

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<number | null>(null);

  const [sortBy, setSortBy]             = useState<SortKey>("date_desc");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterModule, setFilterModule] = useState<string>("ALL");
  const [filterTag, setFilterTag]       = useState<string>("ALL");
  const [filterTech, setFilterTech]     = useState<string>("ALL");

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await argosApi.getList();
        if (mounted) setItems(list);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Erreur lors du chargement");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [setItems]);

  // Polling for pending runs
  const pendingRuns = useMemo(
    () => items.filter((it) => !isFinal(it.status)).map((it) => it.runId),
    [items]
  );

  useEffect(() => {
    if (pendingRuns.length === 0) return;
    const interval = setInterval(async () => {
      try {
        const updates = await Promise.all(
          pendingRuns.map((runId) =>
            argosApi.getRunsByRunId(runId)
              // @ts-ignore
              .then((r) => ({ ok: true as const, runId, r }))
              // @ts-ignore
              .catch((e) => ({ ok: false as const, runId, e }))
          )
        );
        setItems((prev) => {
          const byRun = new Map(prev.map((x) => [x.runId, x]));
          for (const u of updates) {
            if (!u.ok) continue;
            const existing = byRun.get(u.runId);
            if (!existing) continue;
            byRun.set(u.runId, {
              ...existing,
              status: u.r.status,
              resultJson:  u.r.resultJson  ?? existing.resultJson  ?? null,
              finishedAt:  u.r.finishedAt  ?? existing.finishedAt  ?? null,
              reportToken: u.r.reportToken ?? existing.reportToken ?? null,
            });
          }
          return Array.from(byRun.values());
        });
      } catch (e) {
        console.warn("poll error", e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingRuns, setItems]);

  // Derive filter options from data
  const allModules = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => parseReport(item.resultJson)?.score?.byModule?.forEach((m) => ids.add(m.id)));
    return Array.from(ids).sort();
  }, [items]);

  const allTags = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => parseReport(item.resultJson)?.score?.byTag?.forEach((tg) => ids.add(tg.id)));
    return Array.from(ids).sort();
  }, [items]);

  const allTechs = useMemo(() => {
    const techs = new Set<string>();
    items.forEach((item) => extractTechs(parseReport(item.resultJson)).forEach((tc) => techs.add(tc)));
    return Array.from(techs).sort();
  }, [items]);

  // Apply filters + sort
  const displayItems = useMemo(() => {
    let result = [...items];

    if (filterStatus !== "ALL") result = result.filter((i) => i.status === filterStatus);
    if (filterModule !== "ALL") result = result.filter((item) => parseReport(item.resultJson)?.score?.byModule?.some((m) => m.id === filterModule));
    if (filterTag    !== "ALL") result = result.filter((item) => parseReport(item.resultJson)?.score?.byTag?.some((tg) => tg.id === filterTag));
    if (filterTech   !== "ALL") result = result.filter((item) => extractTechs(parseReport(item.resultJson)).includes(filterTech));

    result.sort((a, b) => {
      if (sortBy === "date_desc") return (b.runId ?? 0) - (a.runId ?? 0);
      if (sortBy === "date_asc")  return (a.runId ?? 0) - (b.runId ?? 0);
      const sa = parseReport(a.resultJson)?.score?.global?.ratio ?? -1;
      const sb = parseReport(b.resultJson)?.score?.global?.ratio ?? -1;
      return sortBy === "score_desc" ? sb - sa : sa - sb;
    });

    return result;
  }, [items, filterStatus, filterModule, filterTag, filterTech, sortBy]);

  const hasActiveFilters = filterStatus !== "ALL" || filterModule !== "ALL" || filterTag !== "ALL" || filterTech !== "ALL" || sortBy !== "date_desc";

  function clearFilters() {
    setFilterStatus("ALL"); setFilterModule("ALL");
    setFilterTag("ALL");    setFilterTech("ALL");
    setSortBy("date_desc");
  }

  async function copyJson(runId: number, json: string) {
    try {
      await navigator.clipboard.writeText(prettyJson(json));
      setCopiedRunId(runId);
      window.setTimeout(() => setCopiedRunId((x) => (x === runId ? null : x)), 1200);
    } catch (e) {
      alert("Impossible de copier dans le presse-papier.");
    }
  }

  // Status counts for filter chips
  const statusCounts: Record<string, number> = { ALL: items.length };
  items.forEach((i) => { statusCounts[i.status] = (statusCounts[i.status] ?? 0) + 1; });

  if (loading) return <div className={styles.helper}>{tl.loading}</div>;
  if (error)   return <div className={styles.errorBox}>{error}</div>;

  return (
    <div className={styles.root}>
      <div className={styles.titleRow}>
        <div className={styles.sectionLabel}>{tl.title}</div>
        <div className={styles.count}>
          {displayItems.length !== items.length ? displayItems.length + " / " + items.length : items.length}
        </div>
      </div>

      {items.length > 0 && (
        <FilterBar
          tl={tl}
          statusCounts={statusCounts}
          allModules={allModules}
          allTags={allTags}
          allTechs={allTechs}
          sortBy={sortBy}
          filterStatus={filterStatus}
          filterModule={filterModule}
          filterTag={filterTag}
          filterTech={filterTech}
          hasActiveFilters={hasActiveFilters}
          setSortBy={setSortBy}
          setFilterStatus={setFilterStatus}
          setFilterModule={setFilterModule}
          setFilterTag={setFilterTag}
          setFilterTech={setFilterTech}
          clearFilters={clearFilters}
        />
      )}

      {displayItems.length === 0 ? (
        <div className={styles.emptyCard}>
          {items.length === 0 ? tl.empty : tl.filters.noResults}
        </div>
      ) : (
        displayItems.map((item) => (
          <AuditCard
            key={item.runId}
            item={item}
            report={parseReport(item.resultJson) as AuditReportV2 | null}
            filterModule={filterModule}
            filterTag={filterTag}
            setFilterModule={setFilterModule}
            setFilterTag={setFilterTag}
            copiedRunId={copiedRunId}
            onCopyJson={copyJson}
            tl={tl}
          />
        ))
      )}
    </div>
  );
}