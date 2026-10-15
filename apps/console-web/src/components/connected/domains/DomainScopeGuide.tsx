"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { useAccountSession } from "@/components/account/AccountSession";
import { Surface } from "../Primitives";
import s from "./Domains.module.scss";
import ui from "../Connected.module.scss";

const copy = {
  fr: {
    title: "Avant l’analyse", scope: "Un périmètre précis", scopeHint: "Seul l’hôte saisi est exploré. Les sous-domaines restent exclus.",
    free: "Découverte gratuite", freeHint: "Les liens internes et le sitemap permettent de découvrir les pages, dans le respect de robots.txt. Aucun crédit n’est réservé à cette étape.",
    selection: "Vous choisissez les pages", selectionHint: "Le maximum d’URL à découvrir limite l’exploration, pas votre capacité d’analyse. Vous validez ensuite les pages retenues et leur coût : un crédit par page.",
    available: "crédits disponibles", quotas: "Ouvrir mes quotas",
  },
  en: {
    title: "Before the analysis", scope: "A precise scope", scopeHint: "Only the entered host is explored. Subdomains remain excluded.",
    free: "Free discovery", freeHint: "Internal links and the sitemap help discover pages while respecting robots.txt. No credit is reserved at this stage.",
    selection: "You choose the pages", selectionHint: "The maximum URLs to discover limits exploration, not your analysis capacity. You then confirm the selected pages and their cost: one credit per page.",
    available: "credits available", quotas: "Open my quotas",
  },
};

export default function DomainScopeGuide() {
  const { t, lang } = useLang(), c = copy[lang];
  const session = useAccountSession();
  return <aside aria-label={c.title}><Surface title={c.title}>
    <div className={s.scopeGuide}>
      {[[c.scope, c.scopeHint], [c.free, c.freeHint], [c.selection, c.selectionHint]].map(([title, text]) =>
        <div key={title}><h3>{title}</h3><p>{text}</p></div>)}
    </div>
    <div className={s.scopeQuota}>
      {session.usageError ? <div><p role="status">{t.connected.quotaUnavailable}</p>
        <button type="button" className={ui.secondary} onClick={session.refreshUsage}>{t.connected.retry}</button></div>
        : session.usage ? <p><strong>{session.usage.available === null ? t.connected.unlimitedCredits : new Intl.NumberFormat(lang).format(session.usage.available)}</strong>
          {session.usage.available !== null && <span>{c.available}</span>}</p>
        : <p role="status">{t.connected.loadingQuota}</p>}
      <Link className={s.link} href="/account/usage">{c.quotas}</Link>
    </div>
  </Surface></aside>;
}
