"use client";

import { useEffect } from "react";
import { renewAccountSession } from "@/lib/account-client";

/** Keep the account session alive on public pages as well as inside the account area. */
export default function SessionRenewal({ enabled = false }: { enabled?: boolean }) {
  useEffect(() => {
    let stopped = false;
    let running = false;
    let active = enabled;
    let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      if (running || !active || stopped) return;
      running = true;
      clearTimeout(timer);
      let delay = 10 * 60 * 1000;
      try { await renewAccountSession(); }
      catch { delay = 30 * 1000; }
      running = false;
      if (!stopped && active) timer = setTimeout(renew, delay);
    };
    const visible = () => { if (document.visibilityState === "visible") void renew(); };
    const login = () => { active = true; void renew(); };
    const invalidate = () => { active = false; clearTimeout(timer); };
    void renew();
    window.addEventListener("argos-account-login", login);
    window.addEventListener("argos-account-invalid", invalidate);
    window.addEventListener("focus", renew);
    window.addEventListener("online", renew);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("argos-account-login", login);
      window.removeEventListener("argos-account-invalid", invalidate);
      window.removeEventListener("focus", renew);
      window.removeEventListener("online", renew);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled]);
  return null;
}
