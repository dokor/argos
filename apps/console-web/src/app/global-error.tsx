"use client";

import { useEffect } from "react";
import { createLogger, safeError } from "@/lib/logger";

/**
 * Root-level error boundary (App Router).
 *
 * Only triggers when the root layout itself throws. It *replaces* the root
 * layout, so it must render its own <html>/<body> and cannot use the i18n
 * provider, the layout fonts, or globals.css. Text is therefore static
 * (site default: FR) and styles are fully self-contained (an inline <style>
 * element) so the page never depends on anything that may have failed to load.
 *
 * Le thème sombre suit `prefers-color-scheme` (le ThemeProvider / le toggle ne
 * sont pas disponibles ici) — seul signal accessible pour un boundary
 * catastrophique. Les couleurs reprennent la palette --argos-* mais en dur,
 * pour rester sans dépendance.
 */
const css = `
.ge-body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #0f172a;
  font-family: system-ui, -apple-system, sans-serif;
}
.ge-card {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border: 1px solid transparent;
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.ge-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 12px;
  color: #0f172a;
}
.ge-desc {
  color: #475569;
  font-size: 16px;
  line-height: 1.6;
  margin: 0 0 32px;
}
.ge-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}
.ge-retry {
  border: none;
  cursor: pointer;
  background: #0f172a;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 8px;
  font-family: inherit;
}
.ge-home {
  text-decoration: none;
  background: #ffffff;
  color: #0f172a;
  font-size: 16px;
  font-weight: 600;
  padding: 12px 24px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

@media (prefers-color-scheme: dark) {
  .ge-card { background: #1e293b; border-color: #334155; }
  .ge-title { color: #e2e8f0; }
  .ge-desc { color: #94a3b8; }
  .ge-retry { background: #e2e8f0; color: #0f172a; }
  .ge-home { background: #1e293b; color: #e2e8f0; border-color: #334155; }
}
`;

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
      <body className="ge-body">
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <main role="alert" className="ge-card">
          <h1 className="ge-title">Oups, une erreur est survenue</h1>
          <p className="ge-desc">
            Une erreur inattendue s&apos;est produite. Vous pouvez réessayer ou
            revenir à l&apos;accueil.
          </p>
          <div className="ge-actions">
            <button type="button" onClick={reset} className="ge-retry">
              Réessayer
            </button>
            {/* Full-document navigation on purpose: the app shell has crashed,
                so a hard reload is more reliable than client-side routing. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="ge-home">
              Retour à l&apos;accueil
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
