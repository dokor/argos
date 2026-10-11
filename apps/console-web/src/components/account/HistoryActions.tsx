"use client";
import { useState } from "react";
import Link from "@/components/LocalizedLink";
import AuditForm from "@/components/AuditForm";
import { useLang } from "@/lib/i18n/LangContext";
import { historyCopy } from "./historyCopy";
import type { HistoryContext } from "./history";
import s from "./AccountView.module.scss";
export default function HistoryActions({ context, launchBlocked = false }: { context: HistoryContext; launchBlocked?: boolean }) {
  const { lang } = useLang(), copy = historyCopy[lang];
  const [launch, setLaunch] = useState(false);
  return <aside className={s.card} aria-label={copy.title}>
    <div className={s.actions}><Link href="/account/sites">{copy.sites}</Link><Link href={"/account/urls/" + context.siteUrlId + "/history"}>{copy.title}</Link>
      <button className={s.button} onClick={() => setLaunch(v => !v)} aria-expanded={launch}>{copy.again}</button></div>
    {launch && <AuditForm key={context.siteUrlId} mode="personal" initialUrl={context.normalizedUrl} submitLabel={copy.again} launchBlocked={launchBlocked}/>}
  </aside>;
}
