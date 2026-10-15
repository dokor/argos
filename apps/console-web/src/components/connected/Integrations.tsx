"use client";
import ConnectedIcon from "./ConnectedIcon";
import { useLang } from "@/lib/i18n/LangContext";
import { PageHeading, StatusBadge, Surface } from "./Primitives";
import s from "./Connected.module.scss";
export default function Integrations() {
  const { t } = useLang(), c = t.connected;
  return <main className={s.page}><PageHeading title={c.integrations} description={c.integrationsIntro}/>
    <Surface title={c.automationTitle}><p className={s.lead}>{c.automationDescription}</p></Surface>
    {(["api", "ci", "webhooks"] as const).map(key => <Surface title={<span className={s.iconTitle}><span className={s.iconSquare}><ConnectedIcon name={key}/></span>{c[key].title}</span>} key={key} action={<StatusBadge>{c.soon}</StatusBadge>}>
      <p className={s.lead}>{c[key].description}</p>
      <ul className={s.capabilities}>{c[key].benefits.map(benefit => <li key={benefit}>{benefit}</li>)}</ul>
      <details className={s.example}><summary>{c.example}</summary><p>{c[key].example}</p></details>
    </Surface>)}
    <p className={s.muted}>{c.notAvailable}</p>
  </main>;
}
