"use client";

import { useLang } from "@/lib/i18n/LangContext";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { privacyContent } from "./legalContent";
import s from "./PublicInfo.module.scss";

export default function PrivacyPage() {
  const { lang } = useLang();
  const copy = privacyContent[lang];
  return <div className={s.page} lang={lang}>
    <SiteNav />
    <main>
      <h1>{copy.title}</h1>{copy.intro}
        {copy.sections.map(section => <section key={section.title}><h2>{section.title}</h2>{section.body}</section>)}
    </main>
    <SiteFooter />
  </div>;
}
