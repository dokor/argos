"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { createLogger } from "@/lib/logger";
import ArgosIcon from "@/components/ArgosIcon";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import s from "./not-found.module.scss";

export default function NotFound() {
  const { t } = useLang();
  const nf = t.notFound;
  const isAdmin = useIsAdmin();

  const loggerRef = useRef(createLogger("app", { route: "/not-found" }));
  useEffect(() => {
    // Journalise les accès 404 (liens morts, parcours cassés) — issue #40.
    loggerRef.current.warn("page_not_found", {
      action: "render_not_found",
      details: { referrer: typeof document !== "undefined" ? document.referrer || null : null },
    });
  }, []);

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
            <a href="/faq" className={s.navLink}>
              {t.nav.faq}
            </a>
            <ThemeToggle />
            <LangToggle />
            {isAdmin && (
              <a href="/dashboard" className={s.navCta}>
                {t.nav.openConsole}
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main className={s.content}>
        <span className={s.badge}>{nf.badge}</span>
        <div className={s.code} aria-hidden="true">404</div>
        <h1 className={s.title}>{nf.title}</h1>
        <p className={s.sub}>{nf.sub}</p>
        <div className={s.actions}>
          <Link href="/" className={s.primaryCta}>
            {nf.homeCta}
          </Link>
          <Link href="/faq" className={s.secondaryCta}>
            {nf.faqCta}
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
