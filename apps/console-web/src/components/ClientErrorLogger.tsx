"use client";

import { useEffect, useRef } from "react";
import { createLogger, safeError } from "@/lib/logger";

/**
 * Capture globale des erreurs client non gérées (issue #40).
 * <p>
 * Monté une fois dans le layout racine, il journalise via le logger applicatif :
 * - les erreurs JS non capturées (`window` "error") — hors try/catch et hors
 *   error boundaries React,
 * - les rejets de promesses non gérés (`unhandledrejection`).
 * <p>
 * Ne rend rien. Les listeners sont nettoyés au démontage.
 */
export default function ClientErrorLogger() {
  const loggerRef = useRef(createLogger("app", { route: "global" }));

  useEffect(() => {
    const logger = loggerRef.current;

    function onError(event: ErrorEvent) {
      logger.error("client_uncaught_error", {
        action: "window_error",
        details: {
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          error: event.error ? safeError(event.error) : undefined,
        },
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      logger.error("client_unhandled_rejection", {
        action: "unhandled_rejection",
        details: { reason: safeError(event.reason) },
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
