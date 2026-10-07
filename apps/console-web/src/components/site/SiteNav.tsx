"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n/LangContext";
import fr from "@/lib/i18n/fr.json";
import { useIsAdmin } from "@/lib/useIsAdmin";
import ArgosIcon from "@/components/ArgosIcon";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import s from "./SiteChrome.module.scss";

/** Navigation commune à toutes les pages, sauf les rapports. */
export default function SiteNav({ fixedFrench = false }: { fixedFrench?: boolean }) {
  const { t: localized } = useLang();
  const t = fixedFrench ? fr : localized;
  const pathname = usePathname();
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
          <Link href="/#audit" className={s.navLink} aria-current={pathname === "/" ? "page" : undefined}>
            {t.nav.audit}
          </Link>
          <Link href="/ressources" className={s.navLink} aria-current={pathname === "/ressources" ? "page" : onResources ? "location" : undefined}>
            {t.nav.resources}
          </Link>
          <Link href="/faq" className={s.navLink} aria-current={pathname === "/faq" ? "page" : undefined}>
            {t.nav.faq}
          </Link>
        </div>
        <div className={s.navActions}>
          <ThemeToggle />
          {!fixedFrench && <LangToggle />}
          {isAdmin && (
            <Link href="/dashboard" className={s.navCta} aria-current={pathname === "/dashboard" ? "page" : undefined}>
              {t.nav.openConsole}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
