"use client";

import { useLang } from "@/lib/i18n/LangContext";
import AuthorCredit from "@/components/AuthorCredit";
import s from "./SiteChrome.module.scss";

/**
 * Pied de page partagé des pages marketing (`not-found`, `faq`) — issue #143.
 * La landing conserve son propre footer (navy) au rendu distinct.
 */
export default function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <AuthorCredit className={s.footerLink} />
        <a href="/ressources" className={s.footerLink}>{t.nav.resources}</a>
        <span>{t.landing.footer.copy}</span>
      </div>
    </footer>
  );
}
