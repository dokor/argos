"use client";

import { useEffect } from "react";
import { createLogger, safeError } from "@/lib/logger";

/**
 * Root-level error boundary (App Router).
 *
 * Only triggers when the root layout itself throws. It *replaces* the root
 * layout, so it must render its own <html>/<body> and cannot use the i18n
 * provider or the layout fonts. Text is therefore static (site default: FR)
 * and styles are inline so the page never depends on anything that may have
 * failed to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    createLogger("app", { route: "global-error-boundary" }).error(
      "app_global_render_failed",
      {
        action: "render_global_error_boundary",
        details: {
          error: safeError(error),
          digest: error.digest,
        },
      }
    );
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#0f172a",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#0f172a",
        }}
      >
        <main
          role="alert"
          style={{
            width: "100%",
            maxWidth: "480px",
            background: "#ffffff",
            borderRadius: "16px",
            padding: "40px 32px",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
          }}
        >
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "0 0 12px",
            }}
          >
            Oups, une erreur est survenue
          </h1>
          <p
            style={{
              color: "#475569",
              fontSize: "16px",
              lineHeight: 1.6,
              margin: "0 0 32px",
            }}
          >
            Une erreur inattendue s&apos;est produite. Vous pouvez réessayer ou
            revenir à l&apos;accueil.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                border: "none",
                cursor: "pointer",
                background: "#0f172a",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: "8px",
              }}
            >
              Réessayer
            </button>
            {/* Full-document navigation on purpose: the app shell has crashed,
                so a hard reload is more reliable than client-side routing. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                textDecoration: "none",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "16px",
                fontWeight: 600,
                padding: "12px 24px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            >
              Retour à l&apos;accueil
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
