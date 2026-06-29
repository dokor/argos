"use client";

import React from "react";
import styles from "./StatusBadge.module.css";
import { AuditListItem } from "@/lib/ArgosApi";

type Props = {
  status: AuditListItem["status"];
  labels: Record<string, string>;
};

export default function StatusBadge({ status, labels }: Props) {
  const label = labels[status] ?? status;
  const cls =
    status === "COMPLETED" ? styles.success
    : status === "FAILED"    ? styles.error
    : status === "RUNNING"   ? styles.info
    :                          styles.muted;
  return <div className={`${styles.badge} ${cls}`}>{label}</div>;
}
