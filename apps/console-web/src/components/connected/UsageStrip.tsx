"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { useAccountSession } from "@/components/account/AccountSession";
import { clarteCopy } from "./clarteCopy";
import { Surface } from "./Primitives";
import s from "./Connected.module.scss";
export default function UsageStrip() {
  const {t,lang}=useLang(), c=clarteCopy[lang], session=useAccountSession();
  return <Surface title={c.consumption} action={<Link className={s.textLink} href="/account/usage">{c.quota}</Link>}>
    {session.usage ? <p><strong>{session.usage.offer}</strong> · {session.usage.available===null ? t.connected.unlimitedCredits : `${new Intl.NumberFormat(lang).format(session.usage.available)} ${t.connected.credits}`}</p>
      : session.usageError ? <div className={s.actions}><p role="status">{t.connected.quotaUnavailable}</p><button className={s.secondary} onClick={session.refreshUsage}>{t.connected.retry}</button></div>
      : <p role="status">{t.connected.loadingQuota}</p>}
  </Surface>;
}
