"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { accountFetch } from "@/lib/account-client";
import type { HistoryContext } from "./history";
import HistoryActions from "./HistoryActions";

/** The server authorizes the token against the session; a shared link alone reveals nothing. */
export default function PublicReportHistory() {
  const path=usePathname();
  const [result,setResult]=useState<{path:string;context:HistoryContext}|null>(null);
  useEffect(()=>{
    const token=/^\/(?:en\/)?report\/([A-Za-z0-9_-]{20,512})$/.exec(path)?.[1];
    if(!token) return;
    let alive=true;const controller=new AbortController();
    const clear=()=>{alive=false;controller.abort();setResult(null);};
    window.addEventListener("argos-account-invalid",clear);
    void accountFetch<HistoryContext>("report-context/"+token,"GET",undefined,controller.signal)
      .then(context=>{if(alive)setResult({path,context});}).catch(()=>{});
    return ()=>{alive=false;controller.abort();window.removeEventListener("argos-account-invalid",clear);};
  },[path]);
  return result?.path===path ? <HistoryActions context={result.context}/> : null;
}
