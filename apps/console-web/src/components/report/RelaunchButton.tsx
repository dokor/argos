"use client";

import { useMemo } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { createLogger } from "@/lib/logger";
import { useAuditSubmit } from "@/lib/useAuditSubmit";
import s from "./RelaunchButton.module.scss";

/**
 * Bouton « Relancer l'analyse » (issue #9).
 *
 * Re-soumet la même URL : le backend étant idempotent sur `normalized_url`, cela
 * empile un nouveau run sous le même audit. Le nouveau rapport s'ouvre dans un
 * nouvel onglet (le rapport courant reste ouvert pour une comparaison manuelle) ;
 * `useAuditSubmit` retombe sur une navigation même onglet si la popup est bloquée.
 */
export default function RelaunchButton({ url }: { url: string }) {
  const { t } = useLang();
  const th = t.report.hero;
  const logger = useMemo(() => createLogger("report", { route: "/report" }), []);

  const { phase, submit } = useAuditSubmit({ logger, openInNewTab: true });

  const busy = phase === "submitting" || phase === "redirecting";
  const isError = phase === "error";

  return (
    <div className={s.wrap}>
      <button
        type="button"
        className={s.btn}
        onClick={() => submit(url)}
        disabled={busy || !url}
        aria-label={th.relaunchAria}
      >
        <svg
          className={busy ? `${s.icon} ${s.spinning}` : s.icon}
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        {busy ? th.relaunching : th.relaunch}
      </button>
      {isError && (
        <span className={s.error} role="alert">
          {th.relaunchError}
        </span>
      )}
    </div>
  );
}
