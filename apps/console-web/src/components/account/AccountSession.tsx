"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { accountFetch, AccountClientError, type AccountProfile } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import Link from "@/components/LocalizedLink";
import s from "./AccountView.module.scss";

const Context = createContext<{ profile: AccountProfile | null; ready: boolean; denied: boolean; error: string; invalidate: (reason: unknown) => void }>({profile:null,ready:false,denied:false,error:"",invalidate:()=>{}});
export const useAccountSession = () => useContext(Context);
export default function AccountSession({ children }: { children: React.ReactNode }) {
  const [profile,setProfile]=useState<AccountProfile|null>(null), [ready,setReady]=useState(false), [denied,setDenied]=useState(false), [error,setError]=useState("");
  const invalidate=useCallback((reason:unknown)=>{
    if(reason instanceof AccountClientError && reason.status === 401) { setProfile(null); setDenied(true); setError(reason.code); }
    else if(reason instanceof AccountClientError && reason.code === "email_unverified") { setProfile(p=>p ? {...p,verified:false} : null); setError(reason.code); }
  },[]);
  useEffect(()=>{
    let alive=true;
    const load=()=>{ setReady(false); void accountFetch<AccountProfile>("me").then(p=>{if(alive){setProfile(p);setDenied(false);setError("");setReady(true);}}).catch(reason=>{if(alive){setProfile(null);setError(reason instanceof AccountClientError ? reason.code : "account_unavailable");setReady(true);invalidate(reason);}}); };
    load(); window.addEventListener("argos-account-login",load);
    const stop=()=>invalidate(new AccountClientError("session_invalid",401));
    window.addEventListener("argos-account-invalid",stop);
    return ()=>{alive=false;window.removeEventListener("argos-account-login",load);window.removeEventListener("argos-account-invalid",stop);};
  },[invalidate]);
  useEffect(()=>{
    if(!profile) return;
    let alive=true, timer:ReturnType<typeof setTimeout>;
    const renew=async()=>{try {await accountFetch("auth/renew","POST",{});if(alive) timer=setTimeout(renew,600000);}catch(reason){if(alive) invalidate(reason);}};
    timer=setTimeout(renew,600000);
    return ()=>{alive=false;clearTimeout(timer);};
  },[profile,invalidate]);
  return <Context.Provider value={{profile,ready,denied,error,invalidate}}>{children}</Context.Provider>;
}
export function PersonalNavigation() {
  const {profile,denied}=useAccountSession(),{t}=useLang();
  if(!profile || denied) return null;
  return <nav className={s.personalNav} aria-label={t.account.sites.title}>
    <Link href="/account/sites">{t.account.sites.title}</Link><Link href="/account">{t.account.title}</Link><Link href="/account/sites?analyse=1">{t.account.sites.analyse}</Link>
  </nav>;
}
