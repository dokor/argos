"use client";
import { localizeValue } from "@/lib/i18n/messages";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./StatisticsNavigation.module.scss";

export default function StatisticsNavigation({ active }: { active: "overview" | "product" | "traffic" | "problems" }) {
  const { lang } = useLang();
  const links = [
    ["overview", "/account/admin/analytics/overview", (lang === "fr" ? "Vue d’ensemble" : localizeValue("Overview", lang))],
    ["product", "/account/admin/analytics", (lang === "fr" ? "Mesure produit" : localizeValue("Product measurement", lang))],
    ["traffic", "/account/admin/analytics/traffic", (lang === "fr" ? "Trafic" : localizeValue("Traffic", lang))],
    ["problems", "/account/admin/analytics/problems", (lang === "fr" ? "Problèmes détectés" : localizeValue("Detected problems", lang))],
  ] as const;
  return <nav className={s.nav} aria-label={(lang === "fr" ? "Statistiques" : localizeValue("Statistics", lang))}>
    {links.map(([key, href, label]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
