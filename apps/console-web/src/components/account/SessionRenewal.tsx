"use client";

import { useEffect } from "react";
import { renewAccountSession } from "@/lib/account-client";

/** Keep the account session alive on public pages as well as inside the account area. */
export default function SessionRenewal() {
  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      if (running) return;
      running = true;
      clearTimeout(timer);
      let delay = 10 * 60 * 1000;
      try { await renewAccountSession(); }
      catch { delay = 30 * 1000; }
      running = false;
      if (!stopped) timer = setTimeout(renew, delay);
    };
    const visible = () => { if (document.visibilityState === "visible") void renew(); };
    void renew();
    window.addEventListener("argos-account-login", renew);
    window.addEventListener("focus", renew);
    window.addEventListener("online", renew);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("argos-account-login", renew);
      window.removeEventListener("focus", renew);
      window.removeEventListener("online", renew);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return null;
}
