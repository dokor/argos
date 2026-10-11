"use client";

import Link from "@/components/LocalizedLink";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { frenchPath } from "@/lib/i18n/routes";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useAccountNav } from "@/lib/useAccountNav";
import ArgosIcon from "@/components/ArgosIcon";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import s from "./SiteChrome.module.scss";

/** Navigation commune à toutes les pages, sauf les rapports. */
export default function SiteNav() {
  const { t } = useLang();
  const pathname = frenchPath(usePathname());
  const isAdmin = useIsAdmin();
  const signedIn = useAccountNav();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuOpen = menuPath === pathname;
  const accountLabel = signedIn === false ? t.nav.signUp : t.account.title;
  const onResources = pathname.startsWith("/ressources") || pathname.startsWith("/guides");

  return (
    <nav className={s.nav} aria-label={t.nav.primary} data-menu-open={menuOpen} onKeyDown={event => {
      if (event.key === "Escape" && menuOpen) {
        setMenuPath(null);
        menuButton.current?.focus();
      }
    }}>
      <div className={s.navInner}>
        <Link href="/" className={s.logo} aria-label={t.nav.logo}>
          <ArgosIcon size={22} className={s.logoIcon} />
          <span className={s.logoText}>{t.nav.logo}</span>
        </Link>
        <button ref={menuButton} type="button" className={s.menuToggle} aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu} aria-expanded={menuOpen} aria-controls="site-nav-links site-nav-preferences" onClick={() => setMenuPath(menuOpen ? null : pathname)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
        <div id="site-nav-links" className={s.navLinks}>
          <Link href="/#how-it-works" className={s.navLink} onClick={() => setMenuPath(null)}>{t.nav.how}</Link>
          <Link href="/exemple-rapport" className={s.navLink} onClick={() => setMenuPath(null)} aria-current={pathname === "/exemple-rapport" ? "page" : undefined}>{t.nav.example}</Link>
          <Link href="/ressources" className={s.navLink} onClick={() => setMenuPath(null)} aria-current={onResources ? "location" : undefined}>{t.nav.guides}</Link>
        </div>
        <div className={s.navActions}>
          <Link href="/#audit" className={s.auditCta} onClick={() => setMenuPath(null)}>{t.nav.freeAudit}</Link>
          <Link href={signedIn === false ? "/account/register" : "/account"} className={s.accountLink} aria-current={signedIn !== false && pathname === "/account" ? "page" : undefined}>
            <svg className={s.accountIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </svg>
            <span>{accountLabel}</span>
          </Link>
          <div id="site-nav-preferences" className={s.navPreferences}>
            <ThemeToggle />
            <LangToggle />
            <div className={s.consoleSlot}>
              {isAdmin && (
                <Link href="/dashboard" className={s.navCta} aria-label={t.nav.openConsole} title={t.nav.openConsole} aria-current={pathname === "/dashboard" ? "page" : undefined}>
                  <svg className={s.consoleIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <span className={s.consoleText}>{t.nav.openConsole}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
