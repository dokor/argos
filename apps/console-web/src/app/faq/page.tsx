"use client";

import React from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";
import { useIsAdmin } from "@/lib/useIsAdmin";
import ArgosIcon from "@/components/ArgosIcon";
import LangToggle from "@/components/LangToggle";
import s from "./page.module.scss";

export default function FaqPage() {
  const { t } = useLang();
  const f = t.faq;
  const isAdmin = useIsAdmin();

  return (
    <div className={s.page}>
      {/* NAV */}
      <nav className={s.nav}>
        <div className={s.navInner}>
          <Link href="/" className={s.logo} aria-label={t.nav.logo}>
            <ArgosIcon size={22} className={s.logoIcon} />
            <span className={s.logoText}>{t.nav.logo}</span>
          </Link>
          <div className={s.navRight}>
            <LangToggle />
            {isAdmin && (
              <a href="/dashboard" className={s.navCta}>
                {t.nav.openConsole}
              </a>
            )}
          </div>
        </div>
      </nav>

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
        {f.categories.map((category) => (
          <section key={category.title} className={s.category}>
            <h2 className={s.categoryTitle}>{category.title}</h2>
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
          <p className={s.ctaSub}>{f.stillQuestions.sub}</p>
          <Link href="/" className={s.ctaButton}>
            {f.stillQuestions.cta}
          </Link>
        </section>

        <div className={s.backHomeWrap}>
          <Link href="/" className={s.backHome}>
            {f.backHome}
          </Link>
        </div>
      </main>

      {/* FOOTER */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span>{t.landing.footer.built}</span>
          <span>{t.landing.footer.copy}</span>
        </div>
      </footer>
    </div>
  );
}
