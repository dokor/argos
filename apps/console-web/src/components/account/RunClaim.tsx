"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { accountFetch, AccountClientError, type AccountProfile } from "@/lib/account-client";
import s from "./AccountView.module.scss";
export default function RunClaim() {
  const path = usePathname(), { t } = useLang(), copy = t.account;
  const [run, setRun] = useState<string | null>(null), [profile, setProfile] = useState<AccountProfile | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const token = /^\/(?:en\/)?report\/([A-Za-z0-9_-]+)$/.exec(path)?.[1];
    if (!token) return;
    let alive = true;
    void accountFetch<{ runId: string | null }>("claim-context", "POST", { reportToken: token }).then(context => { if (alive) { setRun(context.runId); setChecked(true); } }).catch(() => {});
    void accountFetch<AccountProfile>("me").then(me => { if (alive) setProfile(me); }).catch(() => {});
    return () => { alive = false; };
  }, [path]);
  if (!run) return checked && profile?.verified ? <aside className={s.card}><p>{copy.claimMissing}</p></aside> : null;
  return <aside className={s.card} aria-label={copy.claim}><p>{copy.claimHint}</p>
    {message && <p role="status">{message}</p>}
    {profile?.verified ? <button className={s.button} disabled={busy || message === copy.claimDone} onClick={async () => {
      setBusy(true);
      try { await accountFetch("runs/" + run + "/claim", "POST", {}); setMessage(copy.claimDone); }
      catch (reason) { const code = reason instanceof AccountClientError ? reason.code : "account_unavailable"; setMessage(copy.errors[code as keyof typeof copy.errors] ?? copy.claimMissing); }
      finally { setBusy(false); }
    }}>{busy ? copy.working : copy.claim}</button> : <Link href={(profile ? "/account" : "/account/sign-in") + "?returnTo=" + encodeURIComponent(path)}>{profile ? copy.verify : copy.signIn}</Link>}
    {message === copy.claimDone && <Link href="/account">{copy.title}</Link>}
  </aside>;
}
