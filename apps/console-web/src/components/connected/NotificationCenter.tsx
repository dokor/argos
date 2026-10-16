"use client";

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

/** One bounded poll for the whole authenticated shell; initial/offline history stays in the inbox. */
export default function NotificationCenter() {
  const { lang } = useLang(), fr = lang === "fr";
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
  const title = (n: Notice) => titles[lang][n.type as keyof typeof titles.fr] ?? (fr ? "Mise à jour" : "Update");
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
    <button ref={button} type="button" className={s.bell} aria-label={`${fr ? "Notifications" : "Notifications"}${inbox?.unread ? ` (${inbox.unread} ${fr ? "non lues" : "unread"})` : ""}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
      {!!inbox?.unread && <span className={s.badge} aria-hidden="true">{inbox.unread > 9 ? "9+" : inbox.unread}</span>}
    </button>
    {open && <section id={id} ref={panel} tabIndex={-1} className={s.panel} aria-label="Notifications">
      <div className={s.heading}><h2>Notifications</h2><button type="button" onClick={close} aria-label={fr ? "Fermer les notifications" : "Close notifications"}>×</button></div>
      {error && <p role="alert">{fr ? "Notifications indisponibles." : "Notifications unavailable."} <button onClick={() => refresh.current()}>{fr ? "Réessayer" : "Retry"}</button></p>}
      {!inbox && !error && <p role="status">{fr ? "Chargement…" : "Loading…"}</p>}
      {inbox && <>{inbox.unread > 0 && <button className={s.all} disabled={busy} onClick={() => void read()}>{fr ? "Tout marquer comme lu" : "Mark all as read"}</button>}
        {!inbox.items.length ? <p>{fr ? "Aucune notification pour le moment." : "No notifications yet."}</p> : <ul>{inbox.items.map(n => <li key={n.id} data-unread={!n.readAt}>
          <span aria-hidden="true">{n.type.endsWith("FAILED") ? "!" : n.type.endsWith("PARTIAL") ? "△" : "✓"}</span>
          <div><Link href={n.href} onClick={() => { void read(n); setOpen(false); }}><strong>{title(n)}</strong><span>{description(n)}</span></Link>
            <time dateTime={n.createdAt}>{new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(new Date(n.createdAt))}</time>
            {!n.readAt && <button disabled={busy} onClick={() => void read(n)}>{fr ? "Marquer comme lu" : "Mark as read"}</button>}
          </div>
        </li>)}</ul>}
        <p className={s.hint}>{fr ? "30 dernières notifications · conservées 90 jours" : "Latest 30 notifications · retained for 90 days"}</p>
      </>}
    </section>}
    <div className={s.toasts} aria-live="polite" aria-atomic="true">{toast && <aside className={s.toast} data-kind={toast.type.endsWith('FAILED')?'error':toast.type.endsWith('PARTIAL')?'partial':'success'} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}>
      <div><strong>{title(toast)}</strong><p>{description(toast)}</p>{toast.type.endsWith('FAILED')&&<p>{fr?'Le résultat n’a pas pu être produit. Consultez le détail pour réessayer.':'The result could not be produced. Open the details to try again.'}</p>}<Link href={toast.href} onClick={() => { void read(toast); setToast(null); }}>{fr ? "Voir le détail" : "View details"}</Link></div>
      <button type="button" onClick={() => setToast(null)} aria-label={fr ? "Fermer la notification" : "Dismiss notification"}>×</button>
    </aside>}</div>
  </div>;
}
