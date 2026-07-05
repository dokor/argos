"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";
import { useIsAdmin } from "@/lib/useIsAdmin";
import ArgosIcon from "@/components/ArgosIcon";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import s from "./SiteChrome.module.scss";

type Props = {
  /** Affiche le lien vers la FAQ (masqué sur la page FAQ elle-même). */
  showFaqLink?: boolean;
};

/**
 * Barre de navigation partagée des pages marketing (`not-found`, `faq`) — issue #143.
 * La landing conserve sa propre nav (rendu distinct : logo, fond thématisé).
 */
export default function SiteNav({ showFaqLink = false }: Props) {
  const { t } = useLang();
  const isAdmin = useIsAdmin();

  return (
    <nav className={s.nav}>
      <div className={s.navInner}>
        <Link href="/" className={s.logo} aria-label={t.nav.logo}>
          <ArgosIcon size={22} className={s.logoIcon} />
          <span className={s.logoText}>{t.nav.logo}</span>
        </Link>
        <div className={s.navRight}>
          {showFaqLink && (
            <a href="/faq" className={s.navLink}>
              {t.nav.faq}
            </a>
          )}
          <ThemeToggle />
          <LangToggle />
          {isAdmin && (
            <a href="/dashboard" className={s.navCta}>
              {t.nav.openConsole}
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
