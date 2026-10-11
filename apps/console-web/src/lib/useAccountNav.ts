"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { accountFetch, AccountClientError, type AccountProfile } from "./account-client";

/** Verify the HttpOnly session through the BFF, including after auth transitions. */
export function useAccountNav(): boolean | null {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let controller: AbortController;
    const load = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      void accountFetch<AccountProfile>("me", "GET", undefined, request.signal)
        .then(() => { if (!request.signal.aborted) setSignedIn(true); })
        .catch(reason => {
          if (!request.signal.aborted) {
            // A service failure must not masquerade as a signed-out session.
            setSignedIn(reason instanceof AccountClientError && reason.status === 401 ? false : null);
          }
        });
    };
    const invalidate = () => { controller?.abort(); setSignedIn(false); };
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
  }, [pathname]);

  return signedIn;
}
