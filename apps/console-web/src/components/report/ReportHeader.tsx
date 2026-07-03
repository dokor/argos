"use client";

import Link from "next/link";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import ArgosIcon from "@/components/ArgosIcon";
import s from "./ReportHeader.module.scss";
import { useLang } from "@/lib/i18n/LangContext";

export default function ReportHeader() {
  const { t } = useLang();

  return (
    <header className={s.header}>
      <div className={s.inner}>
        <Link href="/" className={s.brand}>
          <ArgosIcon size={20} className={s.brandIcon} />
          <span className={s.brandName}>{t.nav.logo}</span>
        </Link>

        <div className={s.right}>
          <span className={s.privateBadge}>{t.report.page.private}</span>
          <ThemeToggle />
            <LangToggle />
        </div>
      </div>
    </header>
  );
}
