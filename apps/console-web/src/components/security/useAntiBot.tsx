"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { AccountClientError } from "@/lib/account-client";
import s from "./AntiBot.module.scss";

type Turnstile = { render: (element: HTMLElement, options: Record<string, unknown>) => string; execute: (id: string) => void; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }
let script: Promise<Turnstile> | null = null;
function load(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (script) return script;
  script = new Promise<Turnstile>((resolve,reject) => {
    const element = document.createElement("script");
    element.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    element.async = true; element.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => { element.remove(); reject(new Error()); }, 12000);
    element.onload = () => { clearTimeout(timer); if(window.turnstile) resolve(window.turnstile); else {element.remove();reject(new Error());} };
    element.onerror = () => { clearTimeout(timer); element.remove(); reject(new Error()); };
    document.head.append(element);
  }).catch(error => {script = null; throw error;});
  return script;
}
export const antiBotCopy = {
  fr: { working:"Vérification anti-robot… Un défi peut apparaître si nécessaire.", error:"La vérification anti-robot est impossible ou a expiré. Réessayez en autorisant challenges.cloudflare.com. Si le problème persiste, contactez-nous via les informations sur le service.", privacy:"Vérification par Cloudflare Turnstile à l’envoi.", help:"Aide et contact" },
  en: { working:"Checking for automated submissions… A challenge may appear if needed.", error:"The anti-bot check failed or expired. Retry allowing challenges.cloudflare.com. If it persists, contact us via the service information page.", privacy:"Cloudflare Turnstile verification on submission.", help:"Help and contact" },
};
/** Fresh execution for every attempt; no token is retained after the mutation. */
export function useAntiBot(action: "register" | "forgot" | "resend" | "audit" | "feedback") {
  const {lang} = useLang(), c=antiBotCopy[lang];
  const container=useRef<HTMLDivElement>(null), widget=useRef<string | null>(null);
  const pending=useRef<{reject:()=>void; timer:ReturnType<typeof setTimeout>} | null>(null), running=useRef(false);
  const [working,setWorking]=useState(false), [failed,setFailed]=useState(false);
  useEffect(()=>()=>{
    if(pending.current) {clearTimeout(pending.current.timer);pending.current.reject();pending.current=null;}
    if(widget.current) window.turnstile?.remove(widget.current);
  },[]);
  async function verify(): Promise<string | undefined> {
    if(running.current) throw new AccountClientError("antibot_unavailable",503);
    running.current=true; setFailed(false);setWorking(true);
    try {
      const response=await fetch("/api/antibot?action="+action,{cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error();
      const config=await response.json();
      if(config.enabled===false) return undefined;
      if(config.enabled!==true || !config.siteKey) throw new Error();
      const api=await load();
      if(!container.current) throw new Error();
      if(widget.current) {api.remove(widget.current);widget.current=null;}
      return await new Promise<string>((resolve,reject)=>{
        const finish=(token?:string)=>{
          if(!pending.current)return;
          clearTimeout(pending.current.timer); pending.current=null;
          if(token) resolve(token); else reject(new Error());
        };
        pending.current={reject:()=>reject(new Error()),timer:setTimeout(()=>finish(),120000)};
        widget.current=api.render(container.current!,{sitekey:config.siteKey,action,language:lang,theme:document.documentElement.dataset.theme ?? "auto",size:"flexible",appearance:"interaction-only",execution:"execute","response-field":false,callback:(token:string)=>finish(token),"error-callback":()=>finish(),"expired-callback":()=>finish(),"timeout-callback":()=>finish()});
        api.execute(widget.current);
      });
    } catch { setFailed(true); throw new AccountClientError("antibot_unavailable",503); }
    finally {if(pending.current){clearTimeout(pending.current.timer);pending.current=null;}running.current=false;setWorking(false);if(widget.current){window.turnstile?.remove(widget.current);widget.current=null;}}
  }
  return {verify,working,element:<div className={s.verification}>
    <div ref={container}/>{working && <p role="status">{c.working}</p>}
    {failed && <p role="alert">{c.error} <a href={lang==="fr"?"/informations-legales":"/en/legal-information"}>{c.help}</a></p>}
    <noscript>{c.error}</noscript>
  </div>};
}
