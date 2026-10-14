"use client";
import Link from "@/components/LocalizedLink";
import { useAccountSession } from "@/components/account/AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./Connected.module.scss";

export default function QuotaSummary() {
  const { profile, denied, usage, usageError, refreshUsage } = useAccountSession();
  const { t, lang } = useLang(), c = t.connected;
  if (!profile?.verified || denied) return null;
  return <div className={s.quota}>
    {usage ? <><Link href="/account/usage">{usage.limit === null ? <strong>{c.unlimitedCredits}</strong> : <><strong>{usage.available==null ? c.quotaUnavailable : new Intl.NumberFormat(lang).format(usage.available)}</strong> {c.credits}</>}</Link><span>{usage.offer}</span></>
      : usageError ? <><span>{c.quotaUnavailable}</span><button onClick={refreshUsage}>{c.retry}</button></> : <span role="status">{c.loadingQuota}</span>}
  </div>;
}
