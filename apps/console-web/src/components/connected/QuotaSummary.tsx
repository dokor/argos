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
    {usage ? <><Link href="/account/settings#usage-heading">{usage.limit === null ? <strong>{c.unlimitedCredits}</strong> : <><strong>{new Intl.NumberFormat(lang).format(Math.max(0, usage.limit - usage.used - usage.reserved))}</strong> {c.credits}</>}</Link><span>{usage.offer}</span></>
      : usageError ? <><span>{c.quotaUnavailable}</span><button onClick={refreshUsage}>{c.retry}</button></> : <span role="status">{c.loadingQuota}</span>}
  </div>;
}
