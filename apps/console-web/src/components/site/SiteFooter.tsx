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
        <a href="/audit-site-pme" className={s.footerLink}>{t.marketing.common.pmeLink}</a>
        <a href="/audit-site-ecommerce" className={s.footerLink}>{t.marketing.common.ecommerceLink}</a>
        <a href="/accessibilite-numerique" className={s.footerLink}>{t.nav.accessibility}</a>
        <a href="/audit-technique-gratuit" className={s.footerLink}>{t.nav.auditTechnique}</a>
        <span>{t.landing.footer.copy}</span>
      </div>
    </footer>
  );
}
