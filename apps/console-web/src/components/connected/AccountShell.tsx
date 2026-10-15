"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from "react";
import {readingSnapshot,subscribeReading} from "@/components/report/reportReading";
import {safeAccountReturn} from "@/lib/account-return";
import { usePathname } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { clarteCopy } from "./clarteCopy";
import ArgosIcon from "@/components/ArgosIcon";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/lib/i18n/LangContext";
import { frenchPath } from "@/lib/i18n/routes";
import { useAccountSession } from "@/components/account/AccountSession";
import { EmptyState, PageHeading } from "./Primitives";
import QuotaSummary from "./QuotaSummary";
import NavigationIcon from "./NavigationIcon";
import AccountMenu from "./AccountMenu";
import s from "./Connected.module.scss";

/** One chrome for private pages; authorization still belongs to each Java resource. */
export default function AccountShell({ children }: { children: ReactNode }) {
  const currentPath = usePathname();
  const suffix=useSyncExternalStore(subscribeReading,readingSnapshot,()=>"");
  // Next route changes do not emit popstate; refresh the language links after commit.
  useEffect(() => { window.dispatchEvent(new Event("argos-reading")); }, [currentPath]);
  const pathname = frenchPath(currentPath);
  const { t } = useLang(), c = t.connected;
  const session = useAccountSession();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });
  const open = openPath === pathname;
  if (/^\/account\/(sign-in|register|verify|forgot|reset)$/.test(pathname)) return children;
  const isAccount = pathname === "/account/settings";
  const isSites = /^\/account\/(analyses|sites|runs|urls)(\/|$)/.test(pathname);
  const valid = session.ready && !!session.profile && !session.denied;
  const admin = valid && session.profile?.verified && session.profile.admin;
  const context = pathname === "/account" ? c.overview : pathname.startsWith("/account/admin") ? c.admin : isSites ? c.sites
    : pathname.startsWith("/account/domains") ? c.domains : pathname === "/account/usage" ? c.usage : pathname === "/account/integrations" ? c.integrations : c.account;
  const close = () => setOpenPath(null);
  const positionTooltip = (target: EventTarget) => {
    if (!(target instanceof Element)) return;
    const item = target.closest("#account-navigation a, #account-navigation button");
    if (!item) return;
    const rect = item.getBoundingClientRect();
    setTooltipPosition({ left: rect.right, top: rect.top + rect.height / 2 });
    setTooltipDismissed(false);
  };
  return <div className={s.shell} data-connected-shell data-collapsed={collapsed} data-tooltip-dismissed={tooltipDismissed} style={{ "--argos-nav-tooltip-left": `${tooltipPosition.left}px`, "--argos-nav-tooltip-top": `${tooltipPosition.top}px` } as CSSProperties}>
    <a href="#account-content" className={s.skip}>{c.skip}</a>
    <aside className={s.sidebar} data-open={open} onKeyDown={event => {
      if (event.key === "Escape") {
        setTooltipDismissed(true);
        if (open) { close(); menuButton.current?.focus(); }
      }
    }} onFocusCapture={event => positionTooltip(event.target)} onMouseOver={event => positionTooltip(event.target)}>
      <div className={s.brandRow}>
        <Link href="/account" className={s.brand} aria-label={c.workspace}><ArgosIcon size={25}/><span>Argos</span></Link>
        <button ref={menuButton} className={s.menu} type="button" aria-expanded={open} aria-controls="account-navigation" onClick={() => setOpenPath(open ? null : pathname)}>{open ? c.closeMenu : c.menu}</button>
      </div>
      <nav id="account-navigation" className={s.navigation} aria-label={c.navigation} onScroll={() => setTooltipDismissed(true)}>
        <div className={s.navHeading}>
          <p className={s.navCaption}>{c.workspace}</p>
          <button type="button" className={s.collapseToggle} aria-label={collapsed ? c.expandMenu : c.collapseMenu} aria-expanded={!collapsed} aria-controls="account-navigation" onClick={() => setCollapsed(value => !value)}>
            <NavigationIcon name={collapsed ? "expand" : "collapse"}/><span className={s.toggleLabel}>{collapsed ? c.expandMenu : c.collapseMenu}</span>
          </button>
        </div>
        <Link href="/account" aria-current={pathname === "/account" ? "page" : undefined} onClick={close} aria-label={c.overview}><NavigationIcon name="overview"/><span className={s.navLabel}>{c.overview}</span></Link>
        <Link href="/account/sites" aria-current={isSites ? "page" : undefined} onClick={close} aria-label={c.sites}><NavigationIcon name="sites"/><span className={s.navLabel}>{c.sites}</span></Link>
        <Link href="/account/domains" aria-current={pathname.startsWith("/account/domains") ? "page" : undefined} onClick={close} aria-label={c.domains}><NavigationIcon name="domains"/><span className={s.navLabel}>{c.domains}</span></Link>
        <Link href="/account/integrations" aria-current={pathname === "/account/integrations" ? "page" : undefined} onClick={close} aria-label={`${c.integrations} — ${c.soon}`}><NavigationIcon name="integrations"/><span className={s.navLabel}>{c.integrations}<span className={s.soon}>{c.soon}</span></span></Link>
        <div className={s.navBottom}>
          <Link href="/account/settings" aria-current={isAccount ? "page" : undefined} onClick={close} aria-label={c.account}><NavigationIcon name="account"/><span className={s.navLabel}>{c.account}</span></Link>
          <Link href="/account/usage" aria-current={pathname === "/account/usage" ? "page" : undefined} onClick={close} aria-label={c.usage}><NavigationIcon name="usage"/><span className={s.navLabel}>{c.usage}</span></Link>
          {admin && <Link href="/account/admin" aria-current={pathname.startsWith("/account/admin") ? "page" : undefined} onClick={close} aria-label={c.admin}><NavigationIcon name="admin"/><span className={s.navLabel}>{c.admin}</span></Link>}
        </div>
        <Link className={s.helpLink} href="/faq" onClick={close} aria-label={c.help}><NavigationIcon name="help"/><span className={s.navLabel}>{c.help}</span></Link>
      </nav>
      {valid && <AccountMenu key={currentPath} profile={session.profile!} onOpen={close} compact={collapsed}/>}
    </aside>
    <div className={s.workspace}>
      <header className={s.topbar}><p>{c.workspace}<span aria-hidden="true"> / </span><strong>{context}</strong></p><QuotaSummary/><div className={s.preferences}><ThemeToggle/><LangToggle/></div></header>
      <div id="account-content" className={s.content} tabIndex={-1}>
        {valid ? children : <main className={s.page}>
          <PageHeading title={c.workspace}/>
          {!session.ready ? <EmptyState title={c.loading} kind="loading"/> : <EmptyState title={session.denied ? c.sessionTitle : c.errorTitle} description={session.denied ? c.sessionDescription : t.account.errors.account_unavailable} kind={session.denied ? "empty" : "error"}>
            {session.denied ? <Link className={s.primary} href={"/account/sign-in?returnTo=" + encodeURIComponent(safeAccountReturn(currentPath+(/\/account(?:\/(domains|runs|admin)(\/|$)|$)/.test(currentPath)?suffix:"")))}>{t.account.signIn}</Link> : <button className={s.secondary} onClick={() => window.dispatchEvent(new Event("argos-account-login"))}>{c.retry}</button>}
          </EmptyState>}
        </main>}
      </div>
      <AccountFooter/>
    </div>
  </div>;
}

export function AccountFooter() {
  const { t, lang } = useLang(), c = t.connected, copy = clarteCopy[lang];
  return <footer className={s.footer}><div className={s.footerIntro}><div><strong>Argos</strong><span>{copy.footer}</span></div><Link href="/feedback">{c.contact} <span aria-hidden="true">↗</span></Link></div><nav aria-label={c.footer}>
    <Link href="/faq">{c.help}</Link><Link href="/">{copy.returnSite} <span aria-hidden="true">↗</span></Link><Link href="/informations-legales">{c.legal}</Link><Link href="/confidentialite">{c.privacy}</Link>
  </nav></footer>;
}
