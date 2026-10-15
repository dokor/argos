"use client";
import SocialProviderLogo, { socialProviderNames } from "./SocialProviderLogo";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/LocalizedLink";
import AuthShell from "./AuthShell";
import PasswordInput from "./PasswordInput";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { safeAccountReturn } from "@/lib/account-return";
import { oauthCallbackError } from "@/lib/oauth-callback-error";
import { accountFormErrors, type AccountField, type AccountFieldErrors } from "@/lib/account-form-validation";
import { useAccountSession } from "./AccountSession";
import s from "./AccountView.module.scss";
import a from "./AuthView.module.scss";
type Mode = "sign-in" | "register" | "verify" | "forgot" | "reset";

export default function AccountView({mode="sign-in"}:{mode?:Mode}) {
  const { t, lang } = useLang(), copy = t.account, router = useRouter();
  const [providers, setProviders] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [token, setToken] = useState(""), [returnTo, setReturnTo] = useState("/account/sites");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const session = useAccountSession();
  const [switchAccount, setSwitchAccount] = useState(false), [initialized, setInitialized] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AccountFieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null), noticeRef = useRef<HTMLParagraphElement>(null);
  const focusTarget = useRef<AccountField | "notice" | null>(null);
  const tokenMode = mode === "reset" || mode === "verify";
  const connected = mode === "sign-in" && session.ready && !!session.profile && !session.denied;
  function fail(reason: unknown) {
    const key = reason instanceof AccountClientError ? reason.code : "account_unavailable";
    if (key === "token_invalid" && tokenMode) { setToken(""); setPassword(""); }
    const field = key === "name_invalid" ? "name" : key === "password_policy" ? "password" : key === "email_invalid" ? "email" : null;
    if (field) { setFieldErrors({ [field]: key } as AccountFieldErrors); focusTarget.current = field; }
    else { setError(copy.errors[key as keyof typeof copy.errors] ?? copy.errors.account_unavailable); focusTarget.current = "notice"; }
  }
  // Run after inputs are enabled again; disabled fields cannot receive focus.
  useEffect(() => {
    if (busy || !focusTarget.current) return;
    const target = focusTarget.current === "notice"
      ? noticeRef.current
      : formRef.current?.querySelector<HTMLInputElement>(`#${focusTarget.current}`);
    // A pending effect can run before the account-switch form is mounted.
    // Keep the request until the target exists in the committed DOM.
    if (!target) return;
    focusTarget.current = null;
    target.focus();
  });
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
    setInitialized(true);
    };
    queueMicrotask(initialize);
    // Mode/language form initialization only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lang]);
  async function act(work: () => Promise<void>) { if (busy) return; setBusy(true); setMessage(""); setError(""); setFieldErrors({}); try { await work(); } catch (reason) { fail(reason); } finally { setBusy(false); } }
  async function social(provider: string) {
    await act(async () => { const result = await accountFetch<{ url: string }>("auth/oauth/" + provider + "/start", "POST", { intent: "login", returnTo }); window.location.assign(result.url); });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !enabled || tokenMode && !token) return;
    const validation = accountFormErrors(mode, name, password);
    setFieldErrors(validation);
    const first = Object.keys(validation)[0] as AccountField | undefined;
    if (first) { setError(""); focusTarget.current = first; return; }
    await act(async () => {
      if (mode === "register") { await accountFetch("auth/register", "POST", { email, password, displayName: name, returnTo }); setMessage(copy.sent); setPassword(""); }
      if (mode === "sign-in") { await accountFetch("auth/login", "POST", { email, password }); router.push(returnTo); router.refresh(); }
      if (mode === "forgot") { await accountFetch("auth/forgot", "POST", { email }); setMessage(copy.forgotSent); focusTarget.current = "notice"; }
      if (mode === "verify") { await accountFetch("auth/verify", "POST", { token }); setMessage(copy.verifiedDone); setToken(""); focusTarget.current = "notice"; }
      if (mode === "reset") { await accountFetch("auth/reset", "POST", { token, password }); setMessage(copy.resetDone); setPassword(""); setToken(""); focusTarget.current = "notice"; }
    });
  }
  const title = mode === "sign-in" ? copy.signIn : mode === "register" ? copy.register : mode === "verify" ? copy.verify : mode === "reset" ? copy.reset : copy.forgot;
  const field = (id: AccountField, label: string, value: string, set: (v: string) => void, type = "text", autoComplete?: string) => {
    const hint = id === "name" ? copy.nameHint : id === "password" && mode !== "sign-in" ? copy.passwordHint : null;
    const invalid = fieldErrors[id];
    const describedBy = [hint && `${id}-hint`, invalid && `${id}-error`].filter(Boolean).join(" ") || undefined;
    const props = { className: s.input, id, value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value); setFieldErrors(previous => ({ ...previous, [id]: undefined })); }, autoComplete, required: true, disabled: busy, maxLength: id === "name" ? 100 : type === "password" ? 256 : 254, "aria-describedby": describedBy, "aria-invalid": invalid ? true : undefined };
    return <div className={s.field}><label htmlFor={id}>{label}</label>
      {type === "password" ? <PasswordInput key={mode} {...props}/> : <input {...props} type={type}/>}
      {hint && <p id={`${id}-hint`}>{hint}</p>}{invalid && <p id={`${id}-error`} className={s.fieldError}>{copy.errors[invalid]}</p>}
      {id === "password" && mode === "sign-in" && <Link className={a.recoveryLink} href={"/account/forgot?returnTo=" + encodeURIComponent(returnTo)}>{copy.forgot}</Link>}
    </div>;
  };
  const recovery = tokenMode && initialized && !token && !message;
  const showForm = (!tokenMode || initialized && !!token && !message) && (!connected || switchAccount) && !(mode === "forgot" && message);
  const settings = localizedPath("/account/settings?section=profile", lang);
  return <AuthShell><main className={`${s.page} ${a.page}`}><h1>{title}</h1>
    {error && <p ref={noticeRef} tabIndex={-1} className={`${s.notice} ${s.error}`} role="alert">{error}</p>}{message && <p ref={noticeRef} tabIndex={-1} className={s.notice} role="status">{message}</p>}
    {!enabled && <p role="status">{copy.unavailable}</p>}
    {mode === "forgot" && !message && <p className={a.intro}>{copy.forgotIntro}</p>}
    {mode === "forgot" && message && <button className={`${s.button} ${a.correction}`} type="button" onClick={() => { setMessage(""); focusTarget.current = "email"; }}>{copy.correctEmail}</button>}
    {connected && <section className={s.notice}><p>{switchAccount ? copy.switchAccountHint : copy.connectedHint}</p><div className={s.links}><Link href={returnTo}>{copy.continueToAccount}</Link>{!switchAccount && <button className={s.button} type="button" onClick={() => { focusTarget.current = "email"; setSwitchAccount(true); }}>{copy.switchAccount}</button>}</div></section>}
    {tokenMode && !initialized && <p role="status">{copy.working}</p>}
    {recovery && <section className={s.recovery} aria-labelledby="recovery-title"><h2 id="recovery-title">{copy.recoveryTitle}</h2><p>{mode === "reset" ? copy.tokenMissing : copy.verifyRecovery}</p><div className={s.links}>
      {mode === "verify" && <Link href={session.profile && !session.denied ? settings : "/account/sign-in?returnTo=" + encodeURIComponent(settings)}>{session.profile && !session.denied ? copy.resendFromAccount : copy.signInToResend}</Link>}
      <Link href={"/account/forgot?returnTo=" + encodeURIComponent(returnTo)}>{mode === "reset" ? copy.requestReset : copy.forgot}</Link>
    </div></section>}
    {showForm && ["register", "sign-in"].includes(mode) && <p className={s.policies}>
      {copy.policyIntro} <Link href="/conditions-utilisation">{copy.policyTerms}</Link> {copy.policyAnd} <Link href="/confidentialite">{copy.policyPrivacy}</Link>.
    </p>}
    {showForm && <form ref={formRef} className={s.form} onSubmit={submit}>
      {mode === "register" && field("name", copy.name, name, setName, "text", "name")}
      {["register", "sign-in", "forgot"].includes(mode) && field("email", copy.email, email, setEmail, "email", "email")}
      {["register", "sign-in", "reset"].includes(mode) && field("password", copy.password, password, setPassword, "password", mode === "sign-in" ? "current-password" : "new-password")}
      <button className={`${s.button} ${a.primary}`} aria-busy={busy} disabled={busy || !enabled || ["verify", "reset"].includes(mode) && !token}>{busy ? copy.working : mode === "forgot" ? copy.sendResetLink : title}</button>
    </form>}
    {mode === "forgot" && <p className={a.providerHint}>{copy.forgotProviderHint}</p>}
    {showForm && ["register", "sign-in"].includes(mode) && providers.length > 0 && <section className={s.social} aria-label={copy.social}>
      <p className={s.socialDivider} aria-hidden="true">{copy.socialSeparator}</p>
      <div className={s.socialActions}>{providers.map(provider => <button type="button" className={`${s.button} ${s.socialButton}`} disabled={busy || !enabled} key={provider} onClick={() => void social(provider)}>
        <SocialProviderLogo provider={provider} />
        <span>{copy.continueWith.replace("{provider}", socialProviderNames[provider] ?? provider)}</span>
      </button>)}</div>
    </section>}
    <div className={s.links}>
      {mode === "register" && <p>{copy.alreadyRegistered} <Link href={"/account/sign-in?returnTo=" + encodeURIComponent(returnTo)}>{copy.signIn}</Link></p>}
      {mode === "sign-in" && <p>{copy.noAccount} <Link href={"/account/register?returnTo=" + encodeURIComponent(returnTo)}>{copy.register}</Link></p>}
      {["forgot", "reset", "verify"].includes(mode) && <Link href={"/account/sign-in?returnTo=" + encodeURIComponent(returnTo)}>{copy.backToSignIn}</Link>}
    </div>
  </main></AuthShell>;
}
