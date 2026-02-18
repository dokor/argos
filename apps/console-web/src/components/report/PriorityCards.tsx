"use client";

import { PriorityItem } from "./types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <TooltipProvider>
      <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Priorités recommandées</CardTitle>
          <CardDescription>
            Les quick wins à fort impact (performance / sécurité / qualité) avec un effort raisonnable.
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
                  <Card
                    key={`${p.title}-${idx}`}
                    className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant={ui.variant}>{ui.label}</Badge>

                        {p.effort ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <Badge variant="outline">Effort {p.effort}</Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              Estimation indicative (XS → L). À affiner en fonction du contexte projet.
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>

                      <div className="text-sm font-semibold">{p.title}</div>
                      <div className="text-sm text-muted-foreground">{p.impact}</div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
