// app/report/[token]/components/IssuesByCategory.tsx
import { Report, Issue } from "./types";

function groupBy<T extends Record<string, any>>(items: T[], key: keyof T) {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = String(it[key] ?? "other");
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

function severityBadge(sev: Issue["severity"]) {
  switch (sev) {
    case "critical":
      return "bg-destructive text-destructive-foreground";
    case "important":
      return "bg-primary text-primary-foreground";
    case "info":
      return "bg-muted text-foreground";
  }
}

function severityLabel(sev: Issue["severity"]) {
  switch (sev) {
    case "critical":
      return "Critique";
    case "important":
      return "Important";
    case "info":
      return "Info";
  }
}

export default function IssuesByCategory({ report }: { report: Report }) {
  const byCat = groupBy(report.issues || [], "categoryKey");
  const categories = report.scores.byCategory || [];

  // We iterate over the category list to keep a stable order (even if no issues)
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <div>
        <h2 className="text-lg font-semibold">Détail par catégorie</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque point contient l’impact et une recommandation. Les détails sont repliés pour garder une lecture
          agréable.
        </p>
      </div>

      <div className="mt-6 grid gap-6">
        {categories.map((cat) => {
          const issues = (byCat.get(cat.key) || []).slice().sort((a, b) => {
            const w = (s: Issue["severity"]) => (s === "critical" ? 0 : s === "important" ? 1 : 2);
            return w(a.severity) - w(b.severity);
          });

          return (
            <div key={cat.key} id={`cat-${cat.key}`} className="scroll-mt-24">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-base font-semibold">{cat.label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {issues.length} point(s) • Score {Math.max(0, Math.min(100, cat.score))}/100
                  </div>
                </div>

                <a
                  href="#top"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground md:text-right"
                >
                  Retour en haut ↑
                </a>
              </div>

              <div className="mt-4 grid gap-3">
                {issues.length === 0 ? (
                  <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
                    Aucun point détecté dans cette catégorie.
                  </div>
                ) : (
                  issues.map((issue) => (
                    <details key={issue.id} className="group rounded-2xl border bg-background p-4">
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityBadge(
                                  issue.severity
                                )}`}
                              >
                                {severityLabel(issue.severity)}
                              </span>
                              {issue.effort && (
                                <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-semibold">
                                  Effort {issue.effort}
                                </span>
                              )}
                              {issue.module && (
                                <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-semibold">
                                  {issue.module}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 truncate text-sm font-semibold">{issue.title}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{issue.impact}</div>
                          </div>

                          <div className="text-sm text-muted-foreground group-open:text-foreground">
                            Détails
                            <span className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span>
                          </div>
                        </div>
                      </summary>

                      <div className="mt-4 grid gap-3 text-sm">
                        {issue.evidence && (
                          <div className="rounded-xl border bg-muted/20 p-3">
                            <div className="text-xs font-semibold text-muted-foreground">Preuve / Contexte</div>
                            <div className="mt-1 whitespace-pre-wrap">{issue.evidence}</div>
                          </div>
                        )}

                        <div className="rounded-xl border bg-muted/20 p-3">
                          <div className="text-xs font-semibold text-muted-foreground">Recommandation</div>
                          <div className="mt-1 whitespace-pre-wrap">{issue.recommendation}</div>
                        </div>
                      </div>
                    </details>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
