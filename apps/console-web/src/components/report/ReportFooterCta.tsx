"use client";
import { useState } from 'react';
import { useLang } from '@/lib/i18n/LangContext';
import { PUBLIC_CONTACT } from '@/lib/publicContact';
import AuthorCredit from '@/components/AuthorCredit';
import { reportShareUrl, validContact } from './reportSharing';
import s from './ReportFooterCta.module.scss';
export default function ReportFooterCta({ contactUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || PUBLIC_CONTACT.emailHref }: { contactUrl?: string }) {
  const {t} = useLang(); const tf=t.report.footerCta;
  const contact=validContact(contactUrl); const [state,setState]=useState<'idle'|'busy'|'copied'|'failed'>('idle');
  async function copyLink() {
    setState('busy'); try { await navigator.clipboard.writeText(reportShareUrl(window.location.href)); setState('copied'); } catch { setState('failed'); }
  }
  return <footer className={s.footer}><div className={s.inner}>
    {contact && <div className={s.copy}><h2 className={s.ctaTitle}>{tf.title}</h2><p className={s.ctaDesc}>{tf.desc}</p></div>}
    <div className={s.actions}>{contact && <a href={contact} className={s.btnPrimary}>{tf.cta}</a>}
      <button type="button" className={s.btnSecondary} onClick={copyLink} disabled={state==='busy'}>{state==='busy'?tf.copying:tf.copyLink}</button>
    </div>
    <p role="status" aria-live="polite" className={s.note}>{state==='copied'?tf.copied:state==='failed'?tf.copyFailed:''}</p>
    <p className={s.note}>{tf.footerNote}</p><p className={s.author}><AuthorCredit className={s.authorLink}/></p>
    {contact && <p className={s.ciNote}>{tf.ciNote} <a href={PUBLIC_CONTACT.emailHref} className={s.ciLink}>{tf.ciContact}</a></p>}
  </div></footer>;
}
