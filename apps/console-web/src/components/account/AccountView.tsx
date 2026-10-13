"use client";
import { useAccountSession, PersonalNavigation } from "./AccountSession";
import UsagePanel from "./UsagePanel";
import SocialProviderLogo, { socialProviderNames } from "./SocialProviderLogo";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import { accountFetch, AccountClientError, type AccountProfile } from "@/lib/account-client";
import { oauthCallbackError } from "@/lib/oauth-callback-error";
import s from "./AccountView.module.scss";
type Mode = "me" | "sign-in" | "register" | "verify" | "forgot" | "reset";
type Method = { id: string; provider: string };
type Session = { id: string; createdAt: string; current: boolean };

export default function AccountView({ mode = "me" }: { mode?: Mode }) {
  const sharedSession=useAccountSession();
  const { t, lang } = useLang(), copy = t.account, router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null), [providers, setProviders] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [methods, setMethods] = useState<Method[] | null>(null), [sessions, setSessions] = useState<Session[]>([]);
  const [token, setToken] = useState(""), [returnTo, setReturnTo] = useState("/account/sites");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [code, setCode] = useState(""), [confirmed, setConfirmed] = useState(false);
  function fail(reason: unknown) { const key = reason instanceof AccountClientError ? reason.code : "account_unavailable"; setError(copy.errors[key as keyof typeof copy.errors] ?? copy.errors.account_unavailable); }
  async function load() {
    const current = await accountFetch<AccountProfile>("me"); setProfile(current); setName(current.displayName); setEmail(current.email ?? "");
    if (current.verified) { const [m, ss] = await Promise.all([accountFetch<Method[]>("methods"), accountFetch<Session[]>("sessions")]); setMethods(m); setSessions(ss); }
  }
  useEffect(() => {
    // Read fragment tokens after hydration, then remove them before further navigation.
    const initialize = () => {
    const raw = new URLSearchParams(window.location.search).get("returnTo");
    const safe = raw && /^\/(?:en\/)?(?:account(?:\/(?:sites(?:\/[1-9]\d{0,18})?|runs\/[1-9]\d{0,18}))?|report\/[A-Za-z0-9_-]{20,512})$/.test(raw) ? raw : localizedPath("/account/sites", lang);
    if (raw) setReturnTo(safe);
    else void accountFetch<{ returnTo: string }>("return").then(value => setReturnTo(value.returnTo === "/account/sites" ? localizedPath("/account/sites", lang) : value.returnTo)).catch(() => setReturnTo(safe));
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (value) { setToken(value); window.history.replaceState(null, "", window.location.pathname + window.location.search); }
    const callbackError = new URLSearchParams(window.location.search).get("error");
    if (callbackError !== null) setError(copy.errors[oauthCallbackError(callbackError)]);
    void accountFetch<{ providers: string[]; enabled: boolean }>("auth/providers").then(p => { setProviders(p.providers); setEnabled(p.enabled); }).catch(fail);
    if (mode === "me") void load().catch(fail);
    };
    queueMicrotask(initialize);
    // Mode/language form initialization only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lang]);
  useEffect(() => {
    if(mode !== "me" || !sharedSession.denied) return;
    queueMicrotask(()=>{setProfile(null);setMethods(null);setSessions([]);setError(copy.errors.session_invalid);});
  },[mode,sharedSession.denied,copy.errors.session_invalid]);
  async function act(work: () => Promise<void>) { if (busy) return; setBusy(true); setMessage(""); setError(""); try { await work(); } catch (reason) { fail(reason); } finally { setBusy(false); } }
  async function social(provider: string, intent = "login") {
    await act(async () => { const result = await accountFetch<{ url: string }>("auth/oauth/" + provider + "/start", "POST", { intent, returnTo: intent === "link" ? localizedPath("/account", lang) : returnTo }); window.location.assign(result.url); });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await act(async () => {
      if (mode === "register") { await accountFetch("auth/register", "POST", { email, password, displayName: name, returnTo }); setMessage(copy.sent); setPassword(""); }
      if (mode === "sign-in") { await accountFetch("auth/login", "POST", { email, password }); router.push(returnTo); router.refresh(); }
      if (mode === "forgot") { await accountFetch("auth/forgot", "POST", { email }); setMessage(copy.sent); }
      if (mode === "verify") { await accountFetch("auth/verify", "POST", { token }); setMessage(copy.done); setToken(""); }
      if (mode === "reset") { await accountFetch("auth/reset", "POST", { token, password }); setMessage(copy.done); setPassword(""); setToken(""); }
    });
  }
  const unlinkedProviders = methods === null ? [] : providers.filter(provider => !methods.some(method => method.provider === provider));
  const title = mode === "me" ? copy.title : mode === "sign-in" ? copy.signIn : mode === "register" ? copy.register : mode === "verify" ? copy.verify : mode === "reset" ? copy.reset : copy.forgot;
  const field = (id: string, label: string, value: string, set: (v: string) => void, type = "text", autoComplete?: string) => <div className={s.field}><label htmlFor={id}>{label}</label><input className={s.input} id={id} type={type} value={value} onChange={e => set(e.target.value)} autoComplete={autoComplete} required disabled={busy} maxLength={type === "password" ? 256 : 254} /></div>;
  return <><div className={s.chrome}><SiteNav /></div>{mode === "me" && <PersonalNavigation/>}<main className={s.page}><h1>{title}</h1>
    {error && <p className={`${s.notice} ${s.error}`} role="alert">{error}</p>}{message && <p className={s.notice} role="status">{message}</p>}
    {!enabled && <p role="status">{copy.unavailable}</p>}
    {["register", "sign-in"].includes(mode) && <p className={s.policies}>
      {copy.policyIntro} <Link href="/conditions-utilisation">{copy.policyTerms}</Link> {copy.policyAnd} <Link href="/confidentialite">{copy.policyPrivacy}</Link>.
    </p>}
    {mode !== "me" && <form className={s.form} onSubmit={submit}>
      {mode === "register" && field("name", copy.name, name, setName, "text", "name")}
      {["register", "sign-in", "forgot"].includes(mode) && field("email", copy.email, email, setEmail, "email", "email")}
      {["register", "sign-in", "reset"].includes(mode) && field("password", copy.password, password, setPassword, "password", mode === "sign-in" ? "current-password" : "new-password")}
      {["register", "reset"].includes(mode) && <p>{copy.passwordHint}</p>}
      {["verify", "reset"].includes(mode) && !token && !message && <p>{copy.tokenMissing}</p>}
      <button className={s.button} disabled={busy || !enabled || ["verify", "reset"].includes(mode) && !token}>{busy ? copy.working : title}</button>
    </form>}
    {["register", "sign-in"].includes(mode) && providers.length > 0 && <section className={s.social} aria-label={copy.social}>
      <p className={s.socialDivider} aria-hidden="true">{copy.socialSeparator}</p>
      <div className={s.socialActions}>{providers.map(provider => <button type="button" className={`${s.button} ${s.socialButton}`} disabled={busy || !enabled} key={provider} onClick={() => void social(provider)}>
        <SocialProviderLogo provider={provider} />
        <span>{copy.continueWith.replace("{provider}", socialProviderNames[provider] ?? provider)}</span>
      </button>)}</div>
    </section>}
    {mode === "me" && profile && <>
      <section className={s.card}><h2>{copy.name}</h2>
        {!profile.verified && <p>{copy.pending}</p>}
        <form className={s.form} onSubmit={e => { e.preventDefault(); void act(async () => { await accountFetch("me", "PATCH", { displayName: name }); setMessage(copy.done); await load(); }); }}>
          {field("profile-name", copy.name, name, setName, "text", "name")}
          <p>{copy.email}: {profile.email ?? "—"}</p><p>{copy.readonly}</p>
          {profile.verified && <button className={s.button} disabled={busy}>{copy.save}</button>}
        </form>
        {!profile.verified && <form className={s.form} onSubmit={e => { e.preventDefault(); void act(async () => { await accountFetch("auth/confirm-email", "POST", { email, returnTo }); setMessage(copy.sent); await load(); }); }}>
          {profile.email ? <p>{copy.email}: {profile.email}</p> : field("verify-email", copy.email, email, setEmail, "email", "email")}<button className={s.button} disabled={busy}>{copy.resend}</button>
        </form>}
        <button className={s.button} disabled={busy} onClick={() => void act(async () => { await accountFetch("auth/logout", "POST", {}); setProfile(null); router.push(localizedPath("/account/sign-in", lang)); })}>{copy.logout}</button>
      </section>
      <section className={s.card}><h2>{copy.reauth}</h2><p>{copy.reauthHint}</p>
        <form className={s.form} onSubmit={e => { e.preventDefault(); void act(async () => { await accountFetch("auth/reauth", "POST", { password: password || undefined, code: code || undefined }); setPassword(""); setCode(""); setMessage(copy.done); }); }}>
          <label htmlFor="current-password">{copy.password}</label><input className={s.input} id="current-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={256} disabled={busy}/>
          <label htmlFor="email-code">{copy.code}</label><input className={s.input} id="email-code" value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" disabled={busy} maxLength={43} />
          <div className={s.actions}><button className={s.button} disabled={busy || !password && !code}>{copy.reauth}</button>
          <button className={s.button} disabled={busy || !profile.email} type="button" onClick={() => void act(async () => { await accountFetch("auth/reauth", "POST", {}); setMessage(copy.sent); })}>{copy.sendCode}</button></div>
        </form>
      </section>
      {profile.verified && <>
        <UsagePanel/>
        <section className={s.card}><h2>{copy.methods}</h2><ul className={s.list}>{methods?.map(method => <li key={method.id}><span>{method.provider === "password" ? copy.password : method.provider === "github" ? "GitHub" : method.provider === "linkedin" ? "LinkedIn" : "Google"}</span><button className={s.button} disabled={busy || methods.length < 2} onClick={() => { if (window.confirm(copy.confirmRemove)) void act(async () => { await accountFetch("methods/" + method.id + "/remove", "POST", { confirmed: true }); await load(); setMessage(copy.done); }); }}>{copy.remove}</button></li>)}</ul>
          {unlinkedProviders.length > 0 && <div className={s.actions}>{unlinkedProviders.map(provider => <button key={provider} className={s.button} disabled={busy} onClick={() => void social(provider, "link")}>{copy.add} {provider}</button>)}</div>}
          <form className={s.form} onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const form = e.currentTarget; void act(async () => { await accountFetch("methods/password", "POST", { password: data.get("newPassword") }); form.reset(); await load(); setMessage(copy.done); }); }}>
            <label htmlFor="new-password">{copy.password}</label><input className={s.input} name="newPassword" id="new-password" type="password" autoComplete="new-password" required maxLength={256} disabled={busy}/><p>{copy.passwordHint}</p><button className={s.button} disabled={busy}>{copy.save}</button>
          </form>
        </section>
        <section className={s.card}><h2>{copy.sessions}</h2><ul className={s.list}>{sessions.map(session => <li key={session.id}><span>{new Date(session.createdAt).toLocaleString(lang)} {session.current ? "— " + copy.current : ""}</span><button className={s.button} disabled={busy} onClick={() => void act(async () => { await accountFetch("sessions/" + session.id, "DELETE", {}); if (session.current) { setProfile(null); router.push(localizedPath("/account/sign-in", lang)); } else await load(); })}>{copy.revoke}</button></li>)}</ul><button className={s.button} disabled={busy} onClick={() => void act(async () => { await accountFetch("sessions/revoke-others", "POST", {}); await load(); setMessage(copy.done); })}>{copy.others}</button></section>
        <section className={s.card}><h2>{copy.sites.title}</h2><Link href="/account/sites">{copy.sites.title}</Link></section>
      </>}
      <section className={s.card}><h2>{copy.archive}</h2><p>{copy.archiveHint}</p><label className={s.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy}/>{copy.confirmArchive}</label><button className={s.button} disabled={busy || !confirmed} onClick={() => void act(async () => { await accountFetch("me/archive", "POST", { confirmed }); setProfile(null); setMessage(copy.done); router.push(localizedPath("/account/sign-in", lang)); })}>{copy.archive}</button></section>
    </>}
    {(mode !== "me" || !profile) && <div className={s.links}>
      {mode === "sign-in" && <Link href={"/account/forgot?returnTo=" + encodeURIComponent(returnTo)}>{copy.forgot}</Link>}
      {mode === "register" && <p>{copy.alreadyRegistered} <Link href={"/account/sign-in?returnTo=" + encodeURIComponent(returnTo)}>{copy.signIn}</Link></p>}
      {["sign-in", "me"].includes(mode) && <p>{copy.noAccount} <Link href={"/account/register?returnTo=" + encodeURIComponent(returnTo)}>{copy.register}</Link></p>}
      {mode === "me" && <p>{copy.alreadyRegistered} <Link href={"/account/sign-in?returnTo=" + encodeURIComponent(returnTo)}>{copy.signIn}</Link></p>}
      {["forgot", "reset", "verify"].includes(mode) && <Link href={"/account/sign-in?returnTo=" + encodeURIComponent(returnTo)}>{copy.backToSignIn}</Link>}
    </div>}
  </main><SiteFooter /></>;
}
