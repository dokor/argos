"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";
import { createLogger, safeError } from "@/lib/logger";
import ArgosIcon from "@/components/ArgosIcon";
import s from "./error.module.scss";

/**
 * Global application error boundary (App Router).
 *
 * Catches unhandled runtime errors thrown while rendering any route under
 * `app/` (except the root layout itself — that is handled by global-error.tsx).
 * Rendered inside the root layout, so the i18n provider and fonts are available.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLang();
  const e = t.error;

  useEffect(() => {
    createLogger("app", { route: "error-boundary" }).error("app_render_failed", {
      action: "render_error_boundary",
      details: {
        error: safeError(error),
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className={s.page}>
      <main className={s.card} role="alert">
        <ArgosIcon size={40} className={s.icon} />
        <span className={s.code}>500</span>
        <h1 className={s.title}>{e.title}</h1>
        <p className={s.description}>{e.description}</p>
        <div className={s.actions}>
          <button type="button" onClick={reset} className={s.primaryBtn}>
            {e.retry}
          </button>
          <Link href="/" className={s.secondaryBtn}>
            {e.backHome}
          </Link>
        </div>
        {error.digest && (
          <p className={s.reference}>
            {e.reference}&nbsp;: <code>{error.digest}</code>
          </p>
        )}
      </main>
    </div>
  );
}
