"use client";

import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import ContactLinks from "./ContactLinks";
import AuthorCredit from "@/components/AuthorCredit";
import s from "./SiteChrome.module.scss";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import { feedbackCopy } from "@/components/feedback/copy";

/** Liens éditoriaux communs à toutes les pages, sauf les rapports privés. */
export default function SiteFooter() {
  const { t, lang } = useLang();
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
          <Link href="/a-propos">{lang === "fr" ? "À propos" : "About Argos"}</Link>
          <Link href="/methodologie-score#resume">{lang === "fr" ? "Méthode du score" : "Scoring method"}</Link>
          <ContactLinks />
          <FeedbackButton type="BUG">{feedbackCopy[lang].bugAction}</FeedbackButton><FeedbackButton type="SUGGESTION">{feedbackCopy[lang].suggestionAction}</FeedbackButton>
          <Link href="/conditions-utilisation">{lang === "fr" ? "Conditions d’utilisation" : "Terms of use"}</Link>
          <Link href="/confidentialite">{lang === "fr" ? f.privacy : "Privacy"}</Link>
          <Link href="/informations-legales">{lang === "fr" ? "Informations sur le service" : "Service information"}</Link>
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
