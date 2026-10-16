"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n/LangContext";
import { publicRoute } from "@/lib/analytics/contract";
import { acquisition } from "@/lib/analytics/traffic";
export default function TrafficAnalytics({granted}:{granted:boolean}){
  const path=usePathname(),{lang}=useLang(),seen=useRef("");
  useEffect(()=>{
    if(!granted){seen.current="";return;}
    const route=publicRoute(path);if(seen.current===path)return;
    if(!route){seen.current=path;return;}
    const source=seen.current ? "internal" : acquisition(location.search,document.referrer,location.origin);
    seen.current=path;
    void fetch("/api/traffic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({route,lang,source}),referrerPolicy:"no-referrer",keepalive:true}).catch(()=>{});
  },[path,lang,granted]);
  return null;
}
