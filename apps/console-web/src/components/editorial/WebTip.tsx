"use client";
import { localizeValue } from "@/lib/i18n/messages";
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n/LangContext';
import { selectWebTip, webTips, type WebTip as Tip } from './webTips';
import s from './WebTip.module.scss';

let pageTip: Tip | undefined;
export default function WebTip({ placement = 'banner' }: { placement?: 'banner' | 'aside' }) {
  const { lang } = useLang();
  const [tip, setTip] = useState<Tip>();
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    let previous: string | null = null;
    try { previous = sessionStorage.getItem('argos-last-web-tip'); } catch { /* Storage is optional. */ }
    pageTip ??= selectWebTip(webTips, lang, previous);
    if (pageTip) { try { sessionStorage.setItem('argos-last-web-tip', pageTip.id); } catch { /* Storage is optional. */ } }
    // The server and first client render share an empty reserved slot.
    setTip(pageTip);
  }, [lang]);
  const text = localizeValue(tip?.translations[lang === "fr" ? "fr" : "en"], lang);
  return <div className={`${s.slot}${placement === 'aside' ? ` ${s.aside}` : ''}`} data-web-tip>{text && tip && <aside className={s.tip} aria-label={(lang === "fr" ? 'Le saviez-vous ?' : localizeValue('Did you know?', lang))}>
    <div className={s.copy}>
    <p className={s.heading}>{(lang === "fr" ? 'Le saviez-vous ?' : localizeValue('Did you know?', lang))}</p>
    <p>{text}</p>
    </div>
    <a href={tip.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{(lang === "fr" ? 'En savoir plus' : localizeValue('Learn more', lang))}<span className={s.sr}> — {text}</span></a>
  </aside>}</div>;
}
