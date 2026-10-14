"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/LocalizedLink";
import ArgosIcon from "@/components/ArgosIcon";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/lib/i18n/LangContext";
import { frenchPath } from "@/lib/i18n/routes";
import { useAccountSession } from "@/components/account/AccountSession";
import { EmptyState, PageHeading } from "./Primitives";
import QuotaSummary from "./QuotaSummary";
import s from "./Connected.module.scss";

/** One chrome for private pages; authorization still belongs to each Java resource. */
export default function AccountShell({ children }: { children: ReactNode }) {
  const currentPath = usePathname();
  // Next route changes do not emit popstate; refresh the language links after commit.
  useEffect(() => { window.dispatchEvent(new Event("argos-reading")); }, [currentPath]);
  const pathname = frenchPath(currentPath);
  const { t } = useLang(), c = t.connected;
  const session = useAccountSession();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const open = openPath === pathname;
  if (/^\/account\/(sign-in|register|verify|forgot|reset)$/.test(pathname)) return children;
  const isAccount = pathname === "/account" || pathname === "/account/settings";
  const isSites = /^\/account\/(analyses|sites|runs|urls)(\/|$)/.test(pathname);
  const valid = session.ready && !!session.profile && !session.denied;
  const admin = valid && session.profile?.verified && session.profile.admin;
  const context = pathname.startsWith("/account/admin") ? c.admin : isSites ? c.sites
    : pathname === "/account/usage" ? c.usage : pathname === "/account/integrations" ? c.integrations : c.account;
  const close = () => setOpenPath(null);
  return <div className={s.shell} data-connected-shell>
    <a href="#account-content" className={s.skip}>{c.skip}</a>
    <aside className={s.sidebar} data-open={open} onKeyDown={event => {
      if (event.key === "Escape" && open) { close(); menuButton.current?.focus(); }
    }}>
      <div className={s.brandRow}>
        <Link href="/account/sites" className={s.brand} aria-label={c.workspace}><ArgosIcon size={25}/><span>Argos</span></Link>
        <Link className={s.mobileAccount} href="/account/settings" aria-current={isAccount ? "page" : undefined} onClick={close}>{c.account}</Link>
        <button ref={menuButton} className={s.menu} type="button" aria-expanded={open} aria-controls="account-navigation" onClick={() => setOpenPath(open ? null : pathname)}>{open ? c.closeMenu : c.menu}</button>
      </div>
      <nav id="account-navigation" className={s.navigation} aria-label={c.navigation}>
        <p className={s.navCaption}>{c.workspace}</p>
        <span className={s.unavailable} aria-disabled="true">{c.overview}<span className={s.soon}>{c.soon}</span></span>
        <Link href="/account/sites" aria-current={isSites ? "page" : undefined} onClick={close}>{c.sites}</Link>
        <span className={s.unavailable} aria-disabled="true">{c.domains}<span className={s.soon}>{c.soon}</span></span>
        <Link href="/account/integrations" aria-current={pathname === "/account/integrations" ? "page" : undefined} onClick={close}>{c.integrations}<span className={s.soon}>{c.soon}</span></Link>
        <div className={s.navBottom}>
          <Link href="/account/settings" aria-current={isAccount ? "page" : undefined} onClick={close}>{c.account}</Link>
          <Link href="/account/usage" aria-current={pathname === "/account/usage" ? "page" : undefined} onClick={close}>{c.usage}</Link>
          {admin && <Link href="/account/admin" aria-current={pathname.startsWith("/account/admin") ? "page" : undefined} onClick={close}>{c.admin}</Link>}
        </div>
      </nav>
      {valid && <div className={s.identity}><span className={s.avatar} aria-hidden="true">{session.profile?.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{session.profile?.displayName}</strong><span>{c.personalSpace}</span></div></div>}
    </aside>
    <div className={s.workspace}>
      <header className={s.topbar}><p>{c.workspace}<span aria-hidden="true"> / </span><strong>{context}</strong></p><QuotaSummary/><div className={s.preferences}><ThemeToggle/><LangToggle/></div></header>
      <div id="account-content" className={s.content} tabIndex={-1}>
        {valid ? children : <main className={s.page}>
          <PageHeading title={c.workspace}/>
          {!session.ready ? <EmptyState title={c.loading} kind="loading"/> : <EmptyState title={session.denied ? c.sessionTitle : c.errorTitle} description={session.denied ? c.sessionDescription : t.account.errors.account_unavailable} kind={session.denied ? "empty" : "error"}>
            {session.denied ? <Link className={s.primary} href={"/account/sign-in?returnTo=" + encodeURIComponent(currentPath)}>{t.account.signIn}</Link> : <button className={s.secondary} onClick={() => window.dispatchEvent(new Event("argos-account-login"))}>{c.retry}</button>}
          </EmptyState>}
        </main>}
      </div>
      <AccountFooter/>
    </div>
  </div>;
}

export function AccountFooter() {
  const { t } = useLang(), c = t.connected;
  return <footer className={s.footer}><span>Argos <span aria-hidden="true">·</span> {c.personalSpace}</span><nav aria-label={c.footer}>
    <Link href="/faq">{c.help}</Link><Link href="/feedback">{c.contact}</Link><Link href="/informations-legales">{c.legal}</Link><Link href="/confidentialite">{c.privacy}</Link>
  </nav></footer>;
}
