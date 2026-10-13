"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { analysisCopy } from "./analysisCopy";
import s from "./Analysis.module.scss";
export default function AnalysisNavigation({ active }: { active: "new" | "sites" }) {
  const c=analysisCopy[useLang().lang];
  return <nav className={s.tabs} aria-label={c.title}><Link href="/account/analyses/new" aria-current={active==="new" ? "page" : undefined}>{c.fresh}</Link><Link href="/account/sites" aria-current={active==="sites" ? "page" : undefined}>{c.sites}</Link></nav>;
}
