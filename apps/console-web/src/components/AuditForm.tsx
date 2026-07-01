"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { argosApi, AuditListItem, CreateAuditRequest, CreateAuditResponse } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";
import { createLogger, safeError, sanitizeUrl } from "@/lib/logger";
import s from "./AuditForm.module.scss";

type Props = {
  onCreated?: (item: AuditListItem) => void;
};

export default function AuditForm({ onCreated }: Props) {
  const { t } = useLang();
  const tf = t.auditForm;
  const router = useRouter();
  const loggerRef = useRef(createLogger("dashboard", { route: "/dashboard" }));

  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMsg(tf.errorUrlMissing);
      return;
    }

    // Ajoute https:// si aucun protocole n'est fourni (ex: "argos.lelouet.fr")
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    loggerRef.current.info("dashboard_audit_submit", {
      action: "create_audit",
      details: {
        addedScheme: normalized !== trimmed,
        url: sanitizeUrl(normalized),
      },
    });

    setSubmitting(true);
    try {
      const payload: CreateAuditRequest = { url: normalized };
      const res: CreateAuditResponse = await argosApi.createAudit(payload);

      // Notifie le parent si nécessaire (dashboard)
      onCreated?.({
        auditId: Number(res.auditId),
        inputUrl: normalized,
        normalizedUrl: res.normalizedUrl ?? "",
        runId: Number(res.runId),
        status: res.status,
        reportToken: res.reportToken ?? null,
        resultJson: null,
      });

      // Redirection immédiate vers la page rapport.
      // La page gère elle-même l'état "en cours" via polling.
      if (res.reportToken) {
        loggerRef.current.info("dashboard_audit_created", {
          action: "redirect_to_report",
          details: {
            reportToken: res.reportToken,
            runId: res.runId,
            status: res.status,
          },
        });
        router.push(`/report/${res.reportToken}`);
      }
    } catch (err: unknown) {
      loggerRef.current.error("dashboard_audit_create_failed", {
        action: "create_audit",
        details: {
          error: safeError(err),
          url: sanitizeUrl(normalized),
        },
      });
      setErrorMsg(err instanceof Error ? err.message : tf.errorUnknown);
      setSubmitting(false);
    }
    // Ne pas reset submitting si redirect : le composant sera démonté
  }

  return (
    <form onSubmit={submit} className={s.form}>
      <div className={s.fieldGroup}>
        <label htmlFor="url" className={s.label}>{tf.urlLabel}</label>
        <input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={tf.urlPlaceholder}
          disabled={submitting}
          className={s.input}
        />
      </div>

      <button type="submit" disabled={submitting} className={s.submitBtn}>
        {submitting ? tf.submitting : tf.submit}
      </button>

      {errorMsg && (
        <div className={s.errorMsg}>❌ {errorMsg}</div>
      )}
    </form>
  );
}
