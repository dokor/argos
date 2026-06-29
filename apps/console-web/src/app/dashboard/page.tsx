"use client";

import React, { useState } from "react";
import AuditForm from "@/components/AuditForm";
import AuditList from "@/components/AuditList";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/lib/i18n/LangContext";
import { AuditListItem } from "@/lib/ArgosApi";

export default function DashboardPage() {
  const { t } = useLang();
  const [items, setItems] = useState<AuditListItem[]>([]);

  function onCreated(newItem: AuditListItem) {
    setItems((prev) => {
      const filtered = prev.filter((x) => x.runId !== newItem.runId);
      return [newItem, ...filtered];
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f1f5f9", padding: 24 }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 22, margin: 0, color: "#0f172a" }}>{t.dashboard.title}</h1>
          <LangToggle />
        </div>

        <AuditForm onCreated={onCreated} />

        <AuditList items={items} setItems={setItems} />
      </div>
    </main>
  );
}
