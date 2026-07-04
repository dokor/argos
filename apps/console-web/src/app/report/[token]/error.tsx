"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { createLogger, safeError } from "@/lib/logger";
import s from "./error.module.scss";

export default function ErrorReport({ error }: { error: Error }) {
  const { t } = useLang();
  const te = t.report.error;

  useEffect(() => {
    createLogger("report", { route: "/report/[token]" }).error("report_render_failed", {
      action: "render_report",
      details: {
        error: safeError(error),
      },
    });
  }, [error]);

  return (
    <div className={s.wrapper}>
      <div className={s.card}>
        <div className={s.title}>{te.title}</div>
        <div className={s.message}>{error.message}</div>
        <Link href="/" className={s.back}>
          {te.back}
        </Link>
      </div>
    </div>
  );
}
