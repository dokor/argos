import { Report, Issue, CategoryScore } from "./types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function groupBy<T extends Record<string, any>>(items: T[], key: keyof T) {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = String(it[key] ?? "other");
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

function severityUi(sev: Issue["severity"]) {
  switch (sev) {
    case "critical":
      return { label: "Critique", variant: "destructive" as const };
    case "important":
      return { label: "Important", variant: "default" as const };
    case "info":
      return { label: "Info", variant: "secondary" as const };
  }
}

export default function IssuesByCategory({ report }: Readonly<{ report: Report }>) {
  const byCat = groupBy(report.issues || [], "categoryKey");
  const categories = report.scores.byCategory || [];

  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Détail par catégorie</CardTitle>
        <CardDescription>
          Chaque point contient l’impact et une recommandation. Les détails sont repliés pour garder une lecture
          agréable.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6">
          {categories.map((cat: CategoryScore) => {
            const issues: Issue[] = (byCat.get(cat.key) || []).slice().sort((a, b) => {
              const w = (s: Issue["severity"]) => (s === "critical" ? 0 : s === "important" ? 1 : 2);
              return w(a.severity) - w(b.severity);
            });

            return (
              <div key={cat.key} id={`cat-${cat.key}`} className="scroll-mt-24">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{cat.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {issues.length} points d'attention • Score {Math.max(0, Math.min(100, cat.score))}/100
                    </div>
                  </div>

                  <a href="#top"
                     className="text-sm font-medium text-muted-foreground hover:text-foreground md:text-right">
                    Retour en haut ↑
                  </a>
                </div>

                <div className="mt-4">
                  {issues.length === 0 ? (
                    <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
                      Aucun point détecté dans cette catégorie.
                    </div>
                  ) : (
                    <Accordion type="multiple" className="space-y-3">
                      {issues.map((issue: Issue) => {
                        const ui = severityUi(issue.severity);
                        return (
                          <AccordionItem key={issue.id} value={issue.id} className="rounded-xl border bg-white px-4">
                            <AccordionTrigger className="py-4">
                              <div
                                className="flex w-full flex-col gap-2 pr-3 text-left md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={ui.variant}>{ui.label}</Badge>

                                    {issue.effort && <Badge variant="outline">Effort {issue.effort}</Badge>}
                                    {issue.module && <Badge variant="outline">{issue.module}</Badge>}
                                  </div>

                                  <div className="mt-2 truncate text-sm font-semibold">{issue.title}</div>
                                  <div className="mt-1 text-sm text-muted-foreground">{issue.impact}</div>
                                </div>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent className="pb-4">
                              <div className="grid gap-3 text-sm">
                                {issue.evidence && (
                                  <div className="rounded-xl border bg-slate-50 p-3">
                                    <div className="text-xs font-semibold text-muted-foreground">Preuve / Contexte</div>
                                    <div className="mt-1 whitespace-pre-wrap">{issue.evidence}</div>
                                  </div>
                                )}

                                <div className="rounded-xl border bg-slate-50 p-3">
                                  <div className="text-xs font-semibold text-muted-foreground">Recommandation</div>
                                  <div className="mt-1 whitespace-pre-wrap">{issue.recommendation}</div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
