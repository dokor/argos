"use client";

import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import fr from "@/lib/i18n/fr.json";
import ContactLinks from "./ContactLinks";
import AuthorCredit from "@/components/AuthorCredit";
import s from "./SiteChrome.module.scss";

/** Liens éditoriaux communs à toutes les pages, sauf les rapports privés. */
export default function SiteFooter({ fixedFrench = false }: { fixedFrench?: boolean }) {
  const { t: localized, lang } = useLang();
  const t = fixedFrench ? fr : localized;
  const f = t.siteFooter;
  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <div className={s.footerBrand}>
          <p className={s.footerBrandName}>{t.nav.logo}</p>
          <p>{f.description}</p>
        </div>
        <nav className={s.footerGroup} aria-label={f.discover}>
          <h2>{f.discover}</h2>
          <Link href="/#audit">{t.nav.audit}</Link>
          <Link href="/ressources">{f.resources}</Link>
          <Link href="/exemple-rapport">{f.exampleReport}</Link>
          <Link href="/faq">{f.faq}</Link>
        </nav>
        <nav className={s.footerGroup} aria-label={f.learn}>
          <h2>{f.learn}</h2>
          <Link href="/ressources/audit-technique-gratuit">{f.technicalAudit}</Link>
          <Link href="/guides/checklist-audit-site-web">{f.checklist}</Link>
          <Link href="/ressources/accessibilite-numerique">{f.accessibility}</Link>
        </nav>
        <nav className={s.footerGroup} aria-label={f.information}>
          <h2>{f.information}</h2>
          <Link href="/a-propos">{fixedFrench || lang === "fr" ? "À propos" : "About Argos"}</Link>
          <Link href="/methodologie-score#resume">{fixedFrench || lang === "fr" ? "Méthode du score" : "Scoring method"}</Link>
          <ContactLinks fixedFrench={fixedFrench} />
          <Link href="/confidentialite">{fixedFrench || lang === "fr" ? f.privacy : "Privacy (French)"}</Link>
          <Link href="/informations-legales">{fixedFrench || lang === "fr" ? "Informations sur le service" : "Service information (French)"}</Link>
          <Link href="/faq#limits">{f.limits}</Link>
          <a href="https://github.com/dokor/argos" target="_blank" rel="noopener noreferrer">{f.source}</a>
        </nav>
      </div>
      <div className={s.footerBottom}>
        <AuthorCredit className={s.footerCreditLink} />
        <span>{t.landing.footer.copy}</span>
      </div>
    </footer>
  );
}
