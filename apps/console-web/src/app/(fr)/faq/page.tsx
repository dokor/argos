"use client";
import { localizeValue } from "@/lib/i18n/messages";

import React from "react";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import SiteNav from "@/components/site/SiteNav";
import ContactLinks from "@/components/site/ContactLinks";
import SiteFooter from "@/components/site/SiteFooter";
import s from "./page.module.scss";

export default function FaqPage() {
  const { t, lang } = useLang();
  const f = t.faq;

  return (
    <div className={s.page}>
      {/* NAV */}
      <SiteNav />

      {/* HERO */}
      <header className={s.hero}>
        <div className={s.heroInner}>
          <span className={s.badge}>{f.hero.badge}</span>
          <h1 className={s.title}>{f.hero.title}</h1>
          <p className={s.sub}>{f.hero.sub}</p>
        </div>
      </header>

      {/* CONTENT */}
      <main className={s.content}>
        <section className={s.decisions} aria-labelledby="decisions-title">
          <h2 id="decisions-title">{(lang === "fr" ? "Avant de lancer un audit" : localizeValue("Before running an audit", lang))}</h2>
          <ul><li>{(lang === "fr" ? "Gratuit, sans compte ni carte bancaire." : localizeValue("Free, without an account or payment card.", lang))}</li><li>{(lang === "fr" ? "Une URL publique analysée : le résultat ne couvre pas tout le site." : localizeValue("One public URL analysed: results do not cover the whole website.", lang))}</li><li>{t.publicPromises.duration}</li><li>{(lang === "fr" ? "La synthèse est accessible par le lien ; les détails nécessitent un compte vérifié. Gardez ce lien confidentiel." : localizeValue("The summary is accessible through the link; details require a verified account. Keep the link confidential.", lang))}</li></ul>
          <p><Link href="/exemple-rapport">{(lang === "fr" ? "Voir le contenu du rapport" : localizeValue("See what the report contains", lang))}</Link> · <Link href="/methodologie-score#resume">{(lang === "fr" ? "Comprendre le score" : localizeValue("Understand the score", lang))}</Link></p>
        </section>
        <nav className={s.contents} aria-label={(lang === "fr" ? "Sommaire de la FAQ" : localizeValue("FAQ contents", lang))}>{f.categories.map(category => <a key={category.id} href={`#${category.id}`}>{category.id === "about" ? ((lang === "fr" ? "Fonctionnement" : localizeValue("How it works", lang))) : category.title}</a>)}</nav>
        {f.categories.map((category) => (
          <section key={category.id} id={category.id} className={s.category}>
            <h2 className={s.categoryTitle}>{category.title}</h2>
            {category.id === "privacy" && <p><Link href="/confidentialite">{(lang === "fr" ? "Données, accès et conservation : les informations détaillées" : localizeValue("Data, access and retention details", lang))}</Link></p>}
            <div className={s.items}>
              {category.items.map((item) => (
                <details key={item.q} className={s.item}>
                  <summary className={s.question}>
                    <span className={s.questionText}>{item.q}</span>
                    <span className={s.chevron} aria-hidden="true" />
                  </summary>
                  <p className={s.answer}>{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* STILL HAVE QUESTIONS */}
        <section className={s.cta}>
          <h2 className={s.ctaTitle}>{f.stillQuestions.title}</h2>
          <ContactLinks />
          <Link href="/#audit" className={s.secondaryAudit}>
            {(lang === "fr" ? "Lancer un audit gratuit" : localizeValue("Run a free audit", lang))}
          </Link>
        </section>

        <div className={s.backHomeWrap}>
          <Link href="/" className={s.backHome}>
            {f.backHome}
          </Link>
        </div>
      </main>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  );
}
