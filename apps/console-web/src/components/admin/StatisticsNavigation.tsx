"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./AdminNavigation.module.scss";

export default function StatisticsNavigation({ active }: { active: "overview" | "product" | "traffic" }) {
  const { lang } = useLang();
  const links = [
    ["overview", "/account/admin/analytics/overview", lang === "fr" ? "Vue d’ensemble" : "Overview"],
    ["product", "/account/admin/analytics", lang === "fr" ? "Mesure produit" : "Product measurement"],
    ["traffic", "/account/admin/analytics/traffic", lang === "fr" ? "Trafic" : "Traffic"],
  ] as const;
  return <nav className={s.nav} aria-label={lang === "fr" ? "Statistiques" : "Statistics"}>
    {links.map(([key, href, label]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
