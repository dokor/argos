"use client";
import ReportActionIcon from "./ReportActionIcon";

import { useState } from "react";
import { reportShareUrl } from "./reportSharing";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ShareReportButton.module.scss";

export default function ShareReportButton({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const labels = t.report.footerCta;
  const [status, setStatus] = useState<"idle" | "busy" | "copied" | "error">("idle");

  async function copyLink() {
    setStatus("busy");
    try {
      await navigator.clipboard.writeText(reportShareUrl(window.location.href));
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={compact ? `${s.share} ${s.compact}` : s.share}>
      <button type="button" className={s.button} onClick={copyLink} disabled={status === "busy"}>
        <ReportActionIcon name="share" />
        {status === "busy" ? labels.copying : compact ? labels.copyLink : labels.shareReport}
      </button>
      <p className={s.status} role="status">
        {status === "copied" ? labels.copied : status === "error" ? labels.copyFailed : ""}
      </p>
    </div>
  );
}
