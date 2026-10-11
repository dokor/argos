"use client";

import { useEffect, useState } from "react";
import { useAccountSession } from "@/components/account/AccountSession";

/**
 * Resolve legacy admin sessions on the server: their cookie is HttpOnly.
 * Modern account pages already provide their verified administrator role.
 */
export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const session = useAccountSession();

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok && (await response.json()).isAdmin === true)
      .then(value => { if (!controller.signal.aborted) setIsAdmin(value); })
      .catch(() => { if (!controller.signal.aborted) setIsAdmin(false); });
    return () => controller.abort();
  }, []);

  return session.ready && !session.denied && session.profile?.verified && session.profile.admin
    ? true : isAdmin;
}
