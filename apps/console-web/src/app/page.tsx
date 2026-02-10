"use client";

import React, { useState } from "react";
import AuditForm from "@/components/AuditForm";
import AuditList from "@/components/AuditList";
import { AuditListItem } from "@/lib/ArgosApi";

export default function HomePage() {
  const [items, setItems] = useState<AuditListItem[]>([]);

  function onCreated(newItem: AuditListItem) {
    setItems((prev) => {
      const filtered = prev.filter((x) => x.runId !== newItem.runId);
      return [newItem, ...filtered];
    });
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f1f5f9", // slate-100
      padding: 24
    }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
        <h1 style={{ fontSize: 22, margin: 0, color: "#0f172a" }}>Argos – Console</h1>

        <AuditForm onCreated={onCreated} />

        <AuditList items={items} setItems={setItems} />
      </div>
    </main>
  );
}
