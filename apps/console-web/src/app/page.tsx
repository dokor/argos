"use client";

import React, { useState } from "react";
import AuditForm from "@/components/AuditForm";
import AuditList from "@/components/AuditList";
import { AuditListItem } from "@/lib/ArgosApi";

export default function HomePage() {
  const [items, setItems] = useState<AuditListItem[]>([]);

  function onCreated(newItem: AuditListItem) {
    setItems((prev: AuditListItem[]) => {
      const filtered: AuditListItem[] = prev.filter((x: AuditListItem) => x.runId !== newItem.runId);
      return [newItem, ...filtered];
    });
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, display: "grid", gap: 18 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Argos – Console</h1>

      <AuditForm onCreated={onCreated} />

      <AuditList items={items} setItems={setItems} />
    </main>
  );
}