"use client";

import React from "react";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import SiteNav from "@/components/site/SiteNav";
import ContactLinks from "@/components/site/ContactLinks";
import SiteFooter from "@/components/site/SiteFooter";
import s from "./page.module.scss";

export default function FaqPage() {
  const { t, lang } = useLang();
  const fr = lang === "fr";
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
          <h2 id="decisions-title">{fr ? "Avant de lancer un audit" : "Before running an audit"}</h2>
          <ul><li>{fr ? "Gratuit, sans compte ni carte bancaire." : "Free, without an account or payment card."}</li><li>{fr ? "Une URL publique analysée : le résultat ne couvre pas tout le site." : "One public URL analysed: results do not cover the whole website."}</li><li>{t.publicPromises.duration}</li><li>{fr ? "Toute personne possédant le lien peut lire le rapport. Gardez ce lien confidentiel." : "Anyone holding the link can read the report. Keep it confidential."}</li></ul>
          <p><Link href="/exemple-rapport">{fr ? "Voir le contenu du rapport" : "See what the report contains"}</Link> · <Link href="/methodologie-score#resume">{fr ? "Comprendre le score" : "Understand the score"}</Link></p>
        </section>
        <nav className={s.contents} aria-label={fr ? "Sommaire de la FAQ" : "FAQ contents"}>{f.categories.map(category => <a key={category.id} href={`#${category.id}`}>{category.id === "about" ? (fr ? "Fonctionnement" : "How it works") : category.title}</a>)}</nav>
        {f.categories.map((category) => (
          <section key={category.id} id={category.id} className={s.category}>
            <h2 className={s.categoryTitle}>{category.title}</h2>
            {category.id === "privacy" && <p><Link href="/confidentialite">{fr ? "Données, accès et conservation : les informations détaillées" : "Data, access and retention details (French)"}</Link></p>}
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
            {fr ? "Lancer un audit gratuit" : "Run a free audit"}
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
