"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ShareReportButton.module.scss";

export default function ShareReportButton({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const labels = t.report.footerCta;
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyLink() {
    setStatus("idle");
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={s.share}>
      <button type="button" className={s.button} onClick={copyLink}>
        {compact ? labels.copyLink : labels.shareReport}
      </button>
      <p className={s.status} role="status">
        {status === "copied" ? labels.linkCopied : status === "error" ? labels.copyError : ""}
      </p>
    </div>
  );
}
