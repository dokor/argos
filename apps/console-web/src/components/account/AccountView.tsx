"use client";
import SocialProviderLogo, { socialProviderNames } from "./SocialProviderLogo";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { safeAccountReturn } from "@/lib/account-return";
import { oauthCallbackError } from "@/lib/oauth-callback-error";
import s from "./AccountView.module.scss";
type Mode = "sign-in" | "register" | "verify" | "forgot" | "reset";

export default function AccountView({mode="sign-in"}:{mode?:Mode}) {
  const { t, lang } = useLang(), copy = t.account, router = useRouter();
  const [providers, setProviders] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [token, setToken] = useState(""), [returnTo, setReturnTo] = useState("/account/sites");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  function fail(reason: unknown) { const key = reason instanceof AccountClientError ? reason.code : "account_unavailable"; setError(copy.errors[key as keyof typeof copy.errors] ?? copy.errors.account_unavailable); }
  useEffect(() => {
    // Read fragment tokens after hydration, then remove them before further navigation.
    const initialize = () => {
    const raw = new URLSearchParams(window.location.search).get("returnTo");
    const safe = raw && safeAccountReturn(raw) === raw ? raw : localizedPath("/account/sites", lang);
    if (raw) setReturnTo(safe);
    else void accountFetch<{ returnTo: string }>("return").then(value => setReturnTo(value.returnTo === "/account/sites" ? localizedPath("/account/sites", lang) : value.returnTo)).catch(() => setReturnTo(safe));
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (value) { setToken(value); window.history.replaceState(null, "", window.location.pathname + window.location.search); }
    const callbackError = new URLSearchParams(window.location.search).get("error");
    if (callbackError !== null) setError(copy.errors[oauthCallbackError(callbackError)]);
    void accountFetch<{ providers: string[]; enabled: boolean }>("auth/providers").then(p => { setProviders(p.providers); setEnabled(p.enabled); }).catch(fail);
    };
    queueMicrotask(initialize);
    // Mode/language form initialization only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lang]);
  async function act(work: () => Promise<void>) { if (busy) return; setBusy(true); setMessage(""); setError(""); try { await work(); } catch (reason) { fail(reason); } finally { setBusy(false); } }
  async function social(provider: string) {
    await act(async () => { const result = await accountFetch<{ url: string }>("auth/oauth/" + provider + "/start", "POST", { intent: "login", returnTo }); window.location.assign(result.url); });
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
  const title = mode === "sign-in" ? copy.signIn : mode === "register" ? copy.register : mode === "verify" ? copy.verify : mode === "reset" ? copy.reset : copy.forgot;
  const field = (id: string, label: string, value: string, set: (v: string) => void, type = "text", autoComplete?: string) => <div className={s.field}><label htmlFor={id}>{label}</label><input className={s.input} id={id} type={type} value={value} onChange={e => set(e.target.value)} autoComplete={autoComplete} required disabled={busy} maxLength={type === "password" ? 256 : 254} /></div>;
  return <><div className={s.chrome}><SiteNav /></div><main className={s.page}><h1>{title}</h1>
    {error && <p className={`${s.notice} ${s.error}`} role="alert">{error}</p>}{message && <p className={s.notice} role="status">{message}</p>}
    {!enabled && <p role="status">{copy.unavailable}</p>}
    {["register", "sign-in"].includes(mode) && <p className={s.policies}>
      {copy.policyIntro} <Link href="/conditions-utilisation">{copy.policyTerms}</Link> {copy.policyAnd} <Link href="/confidentialite">{copy.policyPrivacy}</Link>.
    </p>}
    <form className={s.form} onSubmit={submit}>
      {mode === "register" && field("name", copy.name, name, setName, "text", "name")}
      {["register", "sign-in", "forgot"].includes(mode) && field("email", copy.email, email, setEmail, "email", "email")}
      {["register", "sign-in", "reset"].includes(mode) && field("password", copy.password, password, setPassword, "password", mode === "sign-in" ? "current-password" : "new-password")}
      {["register", "reset"].includes(mode) && <p>{copy.passwordHint}</p>}
      {["verify", "reset"].includes(mode) && !token && !message && <p>{copy.tokenMissing}</p>}
      <button className={s.button} disabled={busy || !enabled || ["verify", "reset"].includes(mode) && !token}>{busy ? copy.working : title}</button>
    </form>
    {["register", "sign-in"].includes(mode) && providers.length > 0 && <section className={s.social} aria-label={copy.social}>
      <p className={s.socialDivider} aria-hidden="true">{copy.socialSeparator}</p>
      <div className={s.socialActions}>{providers.map(provider => <button type="button" className={`${s.button} ${s.socialButton}`} disabled={busy || !enabled} key={provider} onClick={() => void social(provider)}>
        <SocialProviderLogo provider={provider} />
        <span>{copy.continueWith.replace("{provider}", socialProviderNames[provider] ?? provider)}</span>
      </button>)}</div>
    </section>}
    <div className={s.links}>
      {mode === "sign-in" && <Link href={"/account/forgot?returnTo=" + encodeURIComponent(returnTo)}>{copy.forgot}</Link>}
      {mode === "register" && <p>{copy.alreadyRegistered} <Link href={"/account/sign-in?returnTo=" + encodeURIComponent(returnTo)}>{copy.signIn}</Link></p>}
      {mode === "sign-in" && <p>{copy.noAccount} <Link href={"/account/register?returnTo=" + encodeURIComponent(returnTo)}>{copy.register}</Link></p>}
      {["forgot", "reset", "verify"].includes(mode) && <Link href={"/account/sign-in?returnTo=" + encodeURIComponent(returnTo)}>{copy.backToSignIn}</Link>}
    </div>
  </main><SiteFooter /></>;
}
