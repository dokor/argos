import { PriorityItem } from "./types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function severityUi(sev: PriorityItem["severity"]) {
  switch (sev) {
    case "critical":
      return { label: "Critique", variant: "destructive" as const };
    case "important":
      return { label: "Important", variant: "default" as const };
    case "opportunity":
      return { label: "Opportunité", variant: "secondary" as const };
  }
}

export default function PriorityCards({ priorities }: { priorities: PriorityItem[] }) {
  const list = (priorities || []).slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Priorités recommandées</CardTitle>
        <CardDescription>
          Les points ci-dessous maximisent le gain (performance / sécurité / qualité) avec un effort raisonnable.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {list.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune priorité détectée.</div>
          ) : (
            list.map((p, idx) => {
              const ui = severityUi(p.severity);
              return (
                <Card key={`${p.title}-${idx}`} className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant={ui.variant}>{ui.label}</Badge>

                      {p.effort && (
                        <Badge variant="outline" className="font-semibold">
                          Effort {p.effort}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 text-sm font-semibold">{p.title}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{p.impact}</div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
