"use client";
import { intlLocale } from "@/lib/i18n/locales";
import { localizeValue, localizedCopy } from "@/lib/i18n/messages";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/LocalizedLink";
import { accountFetch } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./NotificationCenter.module.scss";

export type Notice = { id: string; type: string; hostname: string; count: number | null; createdAt: string; readAt: string | null; href: string };
export type Inbox = { items: Notice[]; unread: number; cursor: string; serverTime: string };
const titles = {
  fr: { ANALYSIS_READY: "Analyse terminée", ANALYSIS_PARTIAL: "Analyse terminée — résultats partiels", ANALYSIS_FAILED: "Échec de l’analyse", DISCOVERY_READY: "Découverte terminée", DISCOVERY_PARTIAL: "Découverte terminée — résultats partiels", DISCOVERY_FAILED: "Échec de la découverte", BATCH_READY: "Lot terminé", BATCH_PARTIAL: "Lot terminé — résultats partiels", BATCH_FAILED: "Échec du lot" },
  en: { ANALYSIS_READY: "Analysis complete", ANALYSIS_PARTIAL: "Analysis complete — partial results", ANALYSIS_FAILED: "Analysis failed", DISCOVERY_READY: "Discovery complete", DISCOVERY_PARTIAL: "Discovery complete — partial results", DISCOVERY_FAILED: "Discovery failed", BATCH_READY: "Batch complete", BATCH_PARTIAL: "Batch complete — partial results", BATCH_FAILED: "Batch failed" },
};

function ReadIcon({ all = false }: { all?: boolean }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {all ? <path d="m18 6-7 7-3-3M22 10l-7 7-3-3M2 14l3 3 3-3" /> : <path d="m5 12 4 4L19 6" />}
  </svg>;
}

/** One bounded poll for the whole authenticated shell; initial/offline history stays in the inbox. */
export default function NotificationCenter() {
  const { lang } = useLang();
  const [inbox, setInbox] = useState<Inbox | null>(null), [error, setError] = useState(false), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false), [toast, setToast] = useState<Notice | null>(null);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null);
  const refresh = useRef<() => void>(() => {}), channel = useRef<BroadcastChannel | null>(null);
  const id = useId();
  useEffect(() => {
    let active = true, pending = false, cursor: bigint | null = null, previousTime = 0;
    const controller = new AbortController();
    const poll = async (quiet = false) => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const value = await accountFetch<Inbox>("notifications", "GET", undefined, controller.signal);
        if (!active) return;
        const now = Date.now();
        const fresh = cursor === null ? [] : value.items.filter(n => BigInt(n.id) > cursor! && !n.readAt);
        // A disconnected/hidden tab catches up silently; bursts are represented by the inbox badge.
        if (!quiet && document.hasFocus() && cursor !== null && now - previousTime < 45000 && fresh.length === 1) { setPaused(false); setToast(fresh[0]); }
        cursor = BigInt(value.cursor); previousTime = now;
        setInbox(value); setError(false);
      } catch { if (active) { setError(true); previousTime = 0; } }
      finally { pending = false; }
    };
    refresh.current = () => { void poll(true); };
    void poll(true);
    const timer = setInterval(() => { void poll(); }, 15000);
    const visible = () => { if (document.visibilityState === "visible") void poll(true); };
    document.addEventListener("visibilitychange", visible);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("argos-notifications");
      channel.current.onmessage = () => { void poll(true); };
    }
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); channel.current?.close(); channel.current = null; };
  }, []);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (!toast || paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setToast(null), 12000);
    return () => clearTimeout(timer);
  }, [toast, paused]);
  const title = (n: Notice) => localizedCopy(titles, lang)[n.type as keyof typeof titles.fr] ?? ((lang === "fr" ? "Mise à jour" : localizeValue("Update", lang)));
  const description = (n: Notice) => n.hostname + (n.count === null ? "" : ` · ${n.count} URL`);
  async function read(n?: Notice) {
    if (!inbox || busy) return;
    setBusy(true);
    try {
      const value = await accountFetch<Inbox>(n ? `notifications/${n.id}/read` : `notifications/through/${inbox.cursor}/read`, "POST", {});
      setInbox(value); setError(false); channel.current?.postMessage("read");
    } catch { setError(true); } finally { setBusy(false); }
  }
  const close = () => { setOpen(false); button.current?.focus(); };
  return <div className={s.root} ref={root} onKeyDown={event => { if (event.key === "Escape") { close(); setToast(null); } }}>
    <button ref={button} type="button" className={s.bell} aria-label={`${(lang === "fr" ? "Notifications" : localizeValue("Notifications", lang))}${inbox?.unread ? ` (${inbox.unread} ${(lang === "fr" ? "non lues" : localizeValue("unread", lang))})` : ""}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
      {!!inbox?.unread && <span className={s.badge} aria-hidden="true">{inbox.unread > 9 ? "9+" : inbox.unread}</span>}
    </button>
    {open && <section id={id} ref={panel} tabIndex={-1} className={s.panel} aria-label="Notifications">
      <div className={s.heading}>
        <h2>Notifications</h2>
        {!!inbox?.unread && <button type="button" className={s.iconButton} disabled={busy} onClick={() => void read()} aria-label={(lang === "fr" ? "Tout marquer comme lu" : localizeValue("Mark all as read", lang))} title={(lang === "fr" ? "Tout marquer comme lu" : localizeValue("Mark all as read", lang))}><ReadIcon all /></button>}
        <button type="button" className={s.iconButton} onClick={close} aria-label={(lang === "fr" ? "Fermer les notifications" : localizeValue("Close notifications", lang))}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
      {error && <p className={s.message} role="alert">{(lang === "fr" ? "Notifications indisponibles." : localizeValue("Notifications unavailable.", lang))} <button onClick={() => refresh.current()}>{(lang === "fr" ? "Réessayer" : localizeValue("Retry", lang))}</button></p>}
      {!inbox && !error && <p className={s.message} role="status">{(lang === "fr" ? "Chargement…" : localizeValue("Loading…", lang))}</p>}
      {inbox && <>
        {!inbox.items.length ? <p className={s.message}>{(lang === "fr" ? "Aucune notification pour le moment." : localizeValue("No notifications yet.", lang))}</p> : <ul className={s.list}>{inbox.items.map(n => {
          const [headline, detail] = title(n).split(" — ");
          const createdAt = new Date(n.createdAt);
          const fullDate = new Intl.DateTimeFormat(intlLocale(lang), { dateStyle: "long", timeStyle: "short" }).format(createdAt);
          return <li key={n.id} className={s.notice} data-unread={!n.readAt} data-kind={n.type.endsWith("FAILED") ? "error" : n.type.endsWith("PARTIAL") ? "partial" : "success"}>
            <span className={s.statusIcon} aria-hidden="true">{n.type.endsWith("FAILED") ? "!" : n.type.endsWith("PARTIAL") ? "△" : "✓"}</span>
            <div className={s.noticeBody}>
              <Link className={s.noticeLink} href={n.href} onClick={() => { void read(n); setOpen(false); }}>
                <span className={s.titleLine}><strong>{headline}</strong>{detail && <span className={s.detail}>{detail}</span>}</span>
                <span className={s.description}>{description(n)}</span>
              </Link>
              <div className={s.metadata}>
                <time dateTime={n.createdAt} title={fullDate} aria-label={fullDate}>{new Intl.DateTimeFormat(intlLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(createdAt)}</time>
                {!n.readAt && <button type="button" className={s.readButton} disabled={busy} onClick={() => void read(n)} aria-label={(lang === "fr" ? "Marquer comme lu" : localizeValue("Mark as read", lang))}><ReadIcon /><span>{(lang === "fr" ? "Marquer lu" : localizeValue("Mark read", lang))}</span></button>}
              </div>
            </div>
          </li>;
        })}</ul>}
        <p className={s.hint}>{(lang === "fr" ? "30 dernières notifications · 90 jours" : localizeValue("Latest 30 notifications · 90 days", lang))}</p>
      </>}
    </section>}
    <div className={s.toasts} aria-live="polite" aria-atomic="true">{toast && <aside className={s.toast} data-kind={toast.type.endsWith('FAILED')?'error':toast.type.endsWith('PARTIAL')?'partial':'success'} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}>
      <div><strong>{title(toast)}</strong><p>{description(toast)}</p>{toast.type.endsWith('FAILED')&&<p>{(lang === "fr" ? 'Le résultat n’a pas pu être produit. Consultez le détail pour réessayer.' : localizeValue('The result could not be produced. Open the details to try again.', lang))}</p>}<Link href={toast.href} onClick={() => { void read(toast); setToast(null); }}>{(lang === "fr" ? "Voir le détail" : localizeValue("View details", lang))}</Link></div>
      <button type="button" onClick={() => setToast(null)} aria-label={(lang === "fr" ? "Fermer la notification" : localizeValue("Dismiss notification", lang))}>×</button>
    </aside>}</div>
  </div>;
}
