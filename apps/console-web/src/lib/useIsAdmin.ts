"use client";

import { useEffect, useState } from "react";
import { useAccountSession } from "@/components/account/AccountSession";
import { accountFetch, type AccountProfile } from "./account-client";

/** Resolve the current account role, including on shared reports outside AccountSession. */
export function useIsAdmin(): boolean | null {
  const session = useAccountSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (session.ready) return;
    let controller: AbortController;
    const load = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      void accountFetch<AccountProfile>("me", "GET", undefined, request.signal)
        .then(profile => { if (!request.signal.aborted) setIsAdmin(profile.verified && profile.admin === true); })
        .catch(() => { if (!request.signal.aborted) setIsAdmin(false); });
    };
    const invalidate = () => { controller?.abort(); setIsAdmin(false); };
    load();
    window.addEventListener("argos-account-login", load);
    window.addEventListener("argos-account-invalid", invalidate);
    window.addEventListener("focus", load);
    return () => {
      controller?.abort();
      window.removeEventListener("argos-account-login", load);
      window.removeEventListener("argos-account-invalid", invalidate);
      window.removeEventListener("focus", load);
    };
  }, [session.ready]);
  return session.ready
    ? !session.denied && session.profile?.verified === true && session.profile.admin === true
    : isAdmin;
}
