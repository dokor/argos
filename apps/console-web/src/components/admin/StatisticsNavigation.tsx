"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./StatisticsNavigation.module.scss";

export default function StatisticsNavigation({ active }: { active: "overview" | "product" | "traffic" | "problems" }) {
  const { lang } = useLang(), fr = lang === "fr";
  const links = [
    ["overview", "/account/admin/analytics/overview", fr ? "Vue d’ensemble" : "Overview"],
    ["product", "/account/admin/analytics", fr ? "Mesure produit" : "Product measurement"],
    ["traffic", "/account/admin/analytics/traffic", fr ? "Trafic" : "Traffic"],
    ["problems", "/account/admin/analytics/problems", fr ? "Problèmes détectés" : "Detected problems"],
  ] as const;
  return <nav className={s.nav} aria-label={fr ? "Statistiques" : "Statistics"}>
    {links.map(([key, href, label]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
