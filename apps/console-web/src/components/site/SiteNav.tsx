"use client";

import Link from "@/components/LocalizedLink";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n/LangContext";
import { frenchPath } from "@/lib/i18n/routes";
import { useIsAdmin } from "@/lib/useIsAdmin";
import ArgosIcon from "@/components/ArgosIcon";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import s from "./SiteChrome.module.scss";

/** Navigation commune à toutes les pages, sauf les rapports. */
export default function SiteNav() {
  const { t } = useLang();
  const pathname = frenchPath(usePathname());
  const isAdmin = useIsAdmin();
  const onResources = pathname.startsWith("/ressources") || pathname.startsWith("/guides");

  return (
    <nav className={s.nav} aria-label={t.nav.primary}>
      <div className={s.navInner}>
        <Link href="/" className={s.logo} aria-label={t.nav.logo}>
          <ArgosIcon size={22} className={s.logoIcon} />
          <span className={s.logoText}>{t.nav.logo}</span>
        </Link>
        <div className={s.navLinks}>
          <Link href="/#how-it-works" className={s.navLink}>{t.nav.how}</Link>
          <Link href="/exemple-rapport" className={s.navLink} aria-current={pathname === "/exemple-rapport" ? "page" : undefined}>{t.nav.example}</Link>
          <Link href="/ressources" className={s.navLink} aria-current={onResources ? "location" : undefined}>{t.nav.guides}</Link>
          <Link href="/#audit" className={s.auditCta}>{t.landing.hero.cta}</Link>
        </div>
        <div className={s.navActions}>
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
    </nav>
  );
}
