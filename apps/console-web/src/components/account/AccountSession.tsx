"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { accountFetch, AccountClientError, type AccountProfile } from "@/lib/account-client";

export type MonthlyUsage=import("@/lib/connected/contracts").Usage;
const Context = createContext<{ profile: AccountProfile | null; ready: boolean; denied: boolean; error: string; invalidate: (reason: unknown) => void; usage:MonthlyUsage|null;usageError:boolean;refreshUsage:()=>void }>({profile:null,ready:false,denied:false,error:"",invalidate:()=>{},usage:null,usageError:false,refreshUsage:()=>{}});
export const useAccountSession = () => useContext(Context);
export default function AccountSession({ children }: { children: React.ReactNode }) {
  const [profile,setProfile]=useState<AccountProfile|null>(null), [ready,setReady]=useState(false), [denied,setDenied]=useState(false), [error,setError]=useState("");
  const [usage,setUsage]=useState<MonthlyUsage|null>(null),[usageError,setUsageError]=useState(false),[usageRevision,setUsageRevision]=useState(0);
  const profileRequest=useRef(0);
  const refreshUsage=useCallback(()=>setUsageRevision(v=>v+1),[]);
  const invalidate=useCallback((reason:unknown)=>{
    if(reason instanceof AccountClientError && reason.status === 401) { profileRequest.current++; setReady(true); setProfile(null); setDenied(true); setError(reason.code); }
    else if(reason instanceof AccountClientError && reason.code === "email_unverified") { setProfile(p=>p ? {...p,verified:false} : null); setError(reason.code); }
  },[]);
  useEffect(()=>{
    let alive=true;
    const load=(event?:Event)=>{ const request=++profileRequest.current; if(event?.type!=="argos-account-profile") setReady(false); void accountFetch<AccountProfile>("me").then(p=>{if(alive && request===profileRequest.current){setProfile(p);setDenied(false);setError("");setReady(true);}}).catch(reason=>{if(alive && request===profileRequest.current){setProfile(null);setError(reason instanceof AccountClientError ? reason.code : "account_unavailable");setReady(true);invalidate(reason);}}); };
    load(); window.addEventListener("argos-account-login",load); window.addEventListener("argos-account-profile",load);
    const stop=()=>invalidate(new AccountClientError("session_invalid",401));
    window.addEventListener("argos-account-invalid",stop);
    return ()=>{alive=false;window.removeEventListener("argos-account-login",load);window.removeEventListener("argos-account-profile",load);window.removeEventListener("argos-account-invalid",stop);};
  },[invalidate]);
  useEffect(()=>{
    if(!profile) return;
    let alive=true, timer:ReturnType<typeof setTimeout>;
    const renew=async()=>{try {await accountFetch("auth/renew","POST",{});if(alive) timer=setTimeout(renew,600000);}catch(reason){if(alive) invalidate(reason);}};
    timer=setTimeout(renew,600000);
    return ()=>{alive=false;clearTimeout(timer);};
  },[profile,invalidate]);
  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    if(!profile?.verified || denied) {queueMicrotask(()=>{if(alive){setUsage(null);setUsageError(false);}});return ()=>{alive=false;};}
    void accountFetch<MonthlyUsage>("usage","GET",undefined,controller.signal).then(data=>{if(alive){setUsage(data);setUsageError(false);}}).catch(reason=>{if(alive){setUsage(null);setUsageError(true);invalidate(reason);}});
    return ()=>{alive=false;controller.abort();};
  },[profile,denied,usageRevision,invalidate]);
  useEffect(()=>{window.addEventListener("argos-usage-refresh",refreshUsage);return ()=>window.removeEventListener("argos-usage-refresh",refreshUsage);},[refreshUsage]);
  useEffect(()=>{
    if(!usage) return;
    // A one-shot refresh at the calendar boundary; no periodic activity reads.
    const deadline=new Date(usage.resetsAt).getTime()+100;
    if(!Number.isFinite(deadline) || deadline<Date.now()) return;
    let timer:ReturnType<typeof setTimeout>;
    const arm=()=>{const wait=deadline-Date.now();timer=setTimeout(()=>{if(Date.now()>=deadline) refreshUsage();else arm();},Math.min(Math.max(1,wait),2147483647));};
    arm();return ()=>clearTimeout(timer);
  },[usage,refreshUsage]);
  return <Context.Provider value={{profile,ready,denied,error,invalidate,usage,usageError,refreshUsage}}>{children}</Context.Provider>;
}
