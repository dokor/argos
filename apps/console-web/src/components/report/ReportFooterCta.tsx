"use client";

import { useLang } from "@/lib/i18n/LangContext";
import s from "./ReportFooterCta.module.scss";

export default function ReportFooterCta() {
  const { t } = useLang();
  const tf = t.report.footerCta;
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const hasCalendly = Boolean(calendly);

  function copyLink() {
    try { navigator.clipboard.writeText(window.location.href); } catch {}
  }

  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        <div className={s.copy}>
          <h2 className={s.ctaTitle}>{tf.title}</h2>
          <p className={s.ctaDesc}>{tf.desc}</p>
        </div>

        <div className={s.actions}>
          <a
            href={hasCalendly ? calendly : "#"}
            className={`${s.btnPrimary} ${!hasCalendly ? s.disabled : ""}`}
            onClick={(e) => { if (!hasCalendly) e.preventDefault(); }}
          >
            {tf.cta}
          </a>
          <button type="button" className={s.btnSecondary} onClick={copyLink}>
            {tf.copyLink}
          </button>
          {!hasCalendly && <span className={s.soon}>{tf.calendlyComingSoon}</span>}
        </div>

        <p className={s.note}>{tf.footerNote}</p>

        <p className={s.ciNote}>
          Vous voulez intégrer cette analyse dans votre CI ?{" "}
          <a href="mailto:a.lelouet.freelance@gmail.com" className={s.ciLink}>
            Contactez-moi
          </a>
        </p>
      </div>
    </footer>
  );
}
