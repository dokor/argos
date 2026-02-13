// app/report/[token]/components/PriorityCards.tsx
import { PriorityItem } from "./types";

function severityUi(sev: PriorityItem["severity"]) {
  switch (sev) {
    case "critical":
      return { label: "Critique", badge: "bg-destructive text-destructive-foreground" };
    case "important":
      return { label: "Important", badge: "bg-primary text-primary-foreground" };
    case "opportunity":
      return { label: "Opportunité", badge: "bg-muted text-foreground" };
  }
}

export default function PriorityCards({ priorities }: { priorities: PriorityItem[] }) {
  const list = (priorities || []).slice(0, 6);

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Priorités recommandées</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les points ci-dessous sont ceux qui maximisent le gain (performance / sécurité / qualité) avec un effort
            raisonnable.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {list.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucune priorité détectée.</div>
        ) : (
          list.map((p, idx) => {
            const ui = severityUi(p.severity);
            return (
              <div key={`${p.title}-${idx}`} className="rounded-2xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ui.badge}`}>{ui.label}</span>
                  {p.effort && (
                    <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-semibold">
                      Effort {p.effort}
                    </span>
                  )}
                </div>

                <div className="mt-3 text-sm font-semibold">{p.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{p.impact}</div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
