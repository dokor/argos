"use client";

import { PriorityItem } from "./types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLang } from "@/lib/i18n/LangContext";

function severityUi(sev: PriorityItem["severity"], labels: { critical: string; important: string; opportunity: string }) {
  switch (sev) {
    case "critical":
      return { label: labels.critical, variant: "destructive" as const };
    case "important":
      return { label: labels.important, variant: "default" as const };
    case "opportunity":
      return { label: labels.opportunity, variant: "secondary" as const };
  }
}

export default function PriorityCards({ priorities }: { priorities: PriorityItem[] }) {
  const { t } = useLang();
  const tp = t.report.priorityCards;
  const list = (priorities || []).slice(0, 6);

  return (
    <TooltipProvider>
      <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">{tp.title}</CardTitle>
          <CardDescription>
            {tp.desc}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">{tp.empty}</div>
            ) : (
              list.map((p, idx) => {
                const ui = severityUi(p.severity, tp.severity);
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
                                <Badge variant="outline">{tp.effortLabel} {p.effort}</Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {tp.effortTooltip}
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
