"use client";

import Link from "next/link";
import LangToggle from "@/components/LangToggle";
import s from "./ReportHeader.module.scss";
import { useLang } from "@/lib/i18n/LangContext";

export default function ReportHeader({ domain }: Readonly<{ domain: string }>) {
  const { t } = useLang();

  return (
    <header className={s.header}>
      <div className={s.inner}>
        <Link href="/" className={s.brand}>
          <span className={s.brandIcon}>👁</span>
          <span className={s.brandName}>{t.nav.logo}</span>
        </Link>

        <span className={s.sep} aria-hidden>·</span>
        <span className={s.domain}>{domain}</span>

        <div className={s.right}>
          <span className={s.privateBadge}>{t.report.page.private}</span>
          <LangToggle />
        </div>
      </div>
    </header>
  );
}
