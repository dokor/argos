"use client";

import { useLang } from "@/lib/i18n/LangContext";
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
        <span>{t.landing.footer.built}</span>
        <span>{t.landing.footer.copy}</span>
      </div>
    </footer>
  );
}
