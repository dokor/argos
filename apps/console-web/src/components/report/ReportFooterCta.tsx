"use client";

import { useLang } from "@/lib/i18n/LangContext";
import AuthorCredit from "@/components/AuthorCredit";
import ShareReportButton from "./ShareReportButton";
import s from "./ReportFooterCta.module.scss";

export default function ReportFooterCta() {
  const { t } = useLang();
  const tf = t.report.footerCta;
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const hasCalendly = Boolean(calendly);

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
          <ShareReportButton compact />
          {!hasCalendly && <span className={s.soon}>{tf.calendlyComingSoon}</span>}
        </div>

        <div className={s.details}>
          <p className={s.note}>{tf.footerNote}</p>
          <div className={s.credits}>
            <p className={s.author}><AuthorCredit className={s.authorLink} /></p>
            <p className={s.ciNote}>
              {tf.ciNote}{" "}
              <a href="mailto:a.lelouet.freelance@gmail.com" className={s.ciLink}>
                {tf.contact}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
