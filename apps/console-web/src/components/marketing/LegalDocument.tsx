"use client";

import { useLang } from "@/lib/i18n/LangContext";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import type { LegalContent } from "./legalContent";
import s from "./LegalDocument.module.scss";

export default function LegalDocument({ content }: { content: LegalContent }) {
  const { lang } = useLang();
  return <div className={s.page} lang={lang}>
    <SiteNav />
    <main className={s.main}>
      <div className={s.content}>
        <header className={s.intro}><h1>{content.title}</h1>{content.intro}</header>
        <nav className={s.contents} aria-label={lang === "fr" ? "Sommaire de la page" : "On this page"}>
          <p>{lang === "fr" ? "Dans cette page" : "On this page"}</p>
          <ol>{content.sections.map((section, index) => <li key={section.title}>
            <a href={`#legal-section-${index + 1}`}>{section.title}</a>
          </li>)}</ol>
        </nav>
        {content.sections.map((section, index) => <section key={section.title} id={`legal-section-${index + 1}`} aria-labelledby={`legal-heading-${index + 1}`}>
          <h2 id={`legal-heading-${index + 1}`}>{section.title}</h2>{section.body}
        </section>)}
      </div>
    </main>
    <SiteFooter />
  </div>;
}
