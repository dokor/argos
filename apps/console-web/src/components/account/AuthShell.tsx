"use client";

import type { ReactNode } from "react";
import Link from "@/components/LocalizedLink";
import ArgosIcon from "@/components/ArgosIcon";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { useLang } from "@/lib/i18n/LangContext";
import { PUBLIC_CONTACT } from "@/lib/publicContact";
import type { AuthLanguageContext } from "@/lib/account-navigation";
import s from "./AuthShell.module.scss";

export default function AuthShell({ children, authContext }: { children: ReactNode; authContext: AuthLanguageContext }) {
  const { t } = useLang();
  const copy = t.account.authShell;
  return <div className={s.shell}>
    <header className={s.header}>
      <Link href="/" className={s.brand} aria-label={`${t.nav.logo} — ${t.account.back}`}><ArgosIcon size={24}/><span>{t.nav.logo}</span></Link>
      <div className={s.preferences}><ThemeToggle/><LangToggle authContext={authContext}/></div>
    </header>
    {children}
    <footer className={s.footer}>
      <nav aria-label={copy.footer}>
        <Link href="/faq">{copy.help}</Link>
        <a href={PUBLIC_CONTACT.emailHref}>{copy.contact}</a>
        <Link href="/confidentialite">{copy.privacy}</Link>
        <Link href="/conditions-utilisation">{copy.terms}</Link>
      </nav>
    </footer>
  </div>;
}
