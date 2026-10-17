"use client";
import ContextHelp from "@/components/ui/ContextHelp";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { accountsCopy } from "./accountsCopy";
import s from "./AdminNavigation.module.scss";
import { queueCopy } from "./queueCopy";

export default function AdminNavigation({ active }: { active: "users" | "events" | "runs" | "queue" | "feedback" | "analytics" }) {
  const { lang } = useLang(); const c = accountsCopy[lang];
  const links = [["users", c.users], ["events", c.journal], ["runs", c.runs], ["queue", queueCopy[lang].title], ["feedback", c.feedback], ["analytics", c.analytics]] as const;
  return <><nav className={s.nav} aria-label={c.title}>{links.map(([section, label]) =>
    <Link key={section} href={section === "analytics" ? "/account/admin/analytics/overview" : `/account/admin/${section}`} aria-current={active === section ? "page" : undefined}>{label}</Link>)}</nav><ContextHelp topic="admin"/></>;
}
