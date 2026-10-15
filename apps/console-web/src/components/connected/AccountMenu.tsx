"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { useAccountSession } from "@/components/account/AccountSession";
import { accountFetch, AccountClientError, type AccountProfile } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import s from "./AccountMenu.module.scss";

/** A disclosure with normal link/button tab order, shared by desktop and mobile. */
export default function AccountMenu({ profile, onOpen, compact = false }: { profile: AccountProfile; onOpen: () => void; compact?: boolean }) {
  const { t, lang } = useLang(), router = useRouter(), session = useAccountSession();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef(false), id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    // Close at the responsive boundary so a panel cannot move away from keyboard focus.
    const breakpoint = window.matchMedia("(max-width: 900px)");
    const close = () => setOpen(false);
    breakpoint.addEventListener("change", close);
    return () => { document.removeEventListener("pointerdown", outside); breakpoint.removeEventListener("change", close); };
  }, [open]);

  async function logout() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await accountFetch("auth/logout", "POST", {});
    } catch (reason) {
      if (!(reason instanceof AccountClientError && reason.status === 401)) {
        const code = reason instanceof AccountClientError ? reason.code : "account_unavailable";
        setError(t.account.errors[code as keyof typeof t.account.errors] ?? t.account.errors.account_unavailable);
        pending.current = false; setBusy(false); return;
      }
      // An expired session is already signed out; the BFF has cleared its cookie.
    }
    session.invalidate(new AccountClientError("session_invalid", 401));
    router.replace(localizedPath("/account/sign-in", lang));
    router.refresh();
  }

  return <div ref={root} className={s.root} data-compact={compact} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.stopPropagation(); setOpen(false); trigger.current?.focus();
    }
  }}>
    <button ref={trigger} type="button" className={s.trigger} aria-label={`${t.connected.accountMenu}: ${profile.displayName}`} aria-expanded={open} aria-controls={id} onClick={() => {
      if (!open) onOpen();
      setOpen(!open);
    }}>
      <span className={s.avatar} aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</span>
      <span className={s.identity}><strong title={profile.displayName}>{profile.displayName}</strong><span>{t.connected.personalSpace}</span></span>
      <span className={s.mobileLabel}>{t.connected.account}</span>
      <svg className={s.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>
    </button>
    {open && <div id={id} className={s.panel} role="region" aria-label={t.connected.accountMenu}>
      <p className={s.panelIdentity}><strong>{profile.displayName}</strong><span>{t.connected.personalSpace}</span></p>
      <Link href="/account/settings" className={s.action} onClick={() => setOpen(false)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>{t.connected.account}
      </Link>
      <div className={s.separator}/>
      <button type="button" className={s.action} aria-disabled={busy} aria-busy={busy} onClick={() => void logout()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h12"/></svg>{busy ? t.connected.signingOut : t.account.logout}
      </button>
      <span className={s.srOnly} role="status">{busy ? t.connected.signingOut : ""}</span>
      {error && <p className={s.error} role="alert">{error}</p>}
    </div>}
  </div>;
}
