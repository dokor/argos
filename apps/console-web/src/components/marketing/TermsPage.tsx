"use client";

import { useLang } from "@/lib/i18n/LangContext";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { termsContent } from "./legalContent";
import s from "./TermsPage.module.scss";

export default function TermsPage() {
  const { lang } = useLang();
  const copy = termsContent[lang];
  return <div className={s.page} lang={lang}>
    <SiteNav />
    <main className={s.main}>
      <div className={s.content}><header className={s.intro}><h1>{copy.title}</h1>{copy.intro}</header>
        {copy.sections.map(section => <section key={section.title}><h2>{section.title}</h2>{section.body}</section>)}</div>
    </main>
    <SiteFooter />
  </div>;
}
