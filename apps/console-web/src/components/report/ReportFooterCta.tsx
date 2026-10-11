"use client";

import { useLang } from "@/lib/i18n/LangContext";
import { PUBLIC_CONTACT } from "@/lib/publicContact";
import AuthorCredit from "@/components/AuthorCredit";
import ShareReportButton from "./ShareReportButton";
import { validContact } from "./reportSharing";
import s from "./ReportFooterCta.module.scss";

export default function ReportFooterCta({
  contactUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || PUBLIC_CONTACT.emailHref,
}: { contactUrl?: string }) {
  const { t } = useLang();
  const tf = t.report.footerCta;
  const contact = validContact(contactUrl);

  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        {contact && (
          <div className={s.copy}>
            <h2 className={s.ctaTitle}>{tf.title}</h2>
            <p className={s.ctaDesc}>{tf.desc}</p>
          </div>
        )}
        <div className={s.actions}>
          {contact && <a href={contact} className={s.btnPrimary}>{tf.cta}</a>}
          <ShareReportButton compact />
        </div>
        <div className={s.details}>
          <p className={s.note}>{tf.footerNote}</p>
          <div className={s.credits}>
            <p className={s.author}><AuthorCredit className={s.authorLink} /></p>
            {contact && (
              <p className={s.ciNote}>
                {tf.ciNote}{" "}
                <a href={PUBLIC_CONTACT.emailHref} className={s.ciLink}>{tf.ciContact}</a>
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}