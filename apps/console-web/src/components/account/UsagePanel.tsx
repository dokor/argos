"use client";
import { useAccountSession } from "./AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./AccountView.module.scss";
export default function UsagePanel() {
  const {profile,denied,usage,usageError,refreshUsage}=useAccountSession(),{t,lang}=useLang(),copy=t.account.usage;
  if(!profile?.verified || denied) return null;
  return <section className={s.card} aria-labelledby="usage-heading"><h2 id="usage-heading">{copy.title}</h2>
    {usage ? <><dl className={s.usage}>
      <div><dt>{copy.offer}</dt><dd>{usage.offer}</dd></div><div><dt>{copy.used}</dt><dd>{usage.used}</dd></div>
      <div><dt>{copy.reserved}</dt><dd>{usage.reserved}</dd></div><div><dt>{copy.limit}</dt><dd>{usage.limit===null ? copy.unlimited : usage.limit}</dd></div>
      <div><dt>{copy.reset}</dt><dd><time dateTime={usage.resetsAt}>{new Date(usage.resetsAt).toLocaleString(lang,{timeZone:usage.timezone})}</time></dd></div>
      <div><dt>{copy.timezone}</dt><dd>{usage.timezone}</dd></div>
    </dl><p>{copy.hint}</p>{!usage.canLaunch && <p role="status" className={s.notice}>{copy.reached}</p>}</> : <p role={usageError ? "alert" : "status"}>{usageError ? copy.unavailable : t.account.working}</p>}
    <button className={s.button} onClick={refreshUsage}>{copy.refresh}</button>
  </section>;
}
