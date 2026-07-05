"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";
import { createLogger } from "@/lib/logger";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import s from "./not-found.module.scss";

export default function NotFound() {
  const { t } = useLang();
  const nf = t.notFound;

  const loggerRef = useRef(createLogger("app", { route: "/not-found" }));
  useEffect(() => {
    // Journalise les accès 404 (liens morts, parcours cassés) - issue #40.
    loggerRef.current.warn("page_not_found", {
      action: "render_not_found",
      details: { referrer: typeof document !== "undefined" ? document.referrer || null : null },
    });
  }, []);

  return (
    <div className={s.page}>
      {/* NAV */}
      <SiteNav showFaqLink />

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
      <SiteFooter />
    </div>
  );
}
