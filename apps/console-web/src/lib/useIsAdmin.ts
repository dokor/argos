"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if the current user has the argos_admin cookie set.
 * Returns null while hydrating (server-side or before first effect).
 */
export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const has = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("argos_admin="));
    const timerId = window.setTimeout(() => setIsAdmin(has), 0);
    return () => window.clearTimeout(timerId);
  }, []);

  return isAdmin;
}
