"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { accountsCopy } from "./accountsCopy";
import s from "./AdminNavigation.module.scss";

export default function AdminNavigation({ active }: { active: "users" | "events" | "runs" | "feedback" | "analytics" }) {
  const { lang } = useLang(); const c = accountsCopy[lang];
  const links = [["users", c.users], ["events", c.journal], ["runs", c.runs], ["feedback", c.feedback], ["analytics", c.analytics]] as const;
  return <nav className={s.nav} aria-label={c.title}>{links.map(([section, label]) =>
    <Link key={section} href={`/account/admin/${section}`} aria-current={active === section ? "page" : undefined}>{label}</Link>)}</nav>;
}
