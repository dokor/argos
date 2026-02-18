"use client";

import { Report, Issue, CategoryScore } from "./types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import React from "react";

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
      return "destructive" as const;
    case "important":
      return "default" as const;
    case "info":
      return "secondary" as const;
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

function severityWeight(sev: Issue["severity"]) {
  return sev === "critical" ? 0 : sev === "important" ? 1 : 2;
}

type Filter = "all" | "critical" | "important" | "info";

export default function IssuesByCategory({ report }: { report: Report }) {
  const [filter, setFilter] = React.useState<Filter>("all");

  const categories: CategoryScore[] = report.scores.byCategory || [];
  const allIssues: Issue[] = report.issues || [];

  const filteredIssues: Issue[] =
    filter === "all" ? allIssues : allIssues.filter((i: Issue) => i.severity === filter);

  const byCat: Map<string, Issue[]> = groupBy(filteredIssues, "categoryKey");

  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-lg">Détail par catégorie</CardTitle>
            <CardDescription>
              Filtre par sévérité, puis explore les points par catégorie (tri critique → info).
            </CardDescription>
          </div>

          <Tabs value={filter} onValueChange={(v: string) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="critical">Critiques</TabsTrigger>
              <TabsTrigger value="important">Importants</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {categories.map((cat: CategoryScore) => {
          const issues: Issue[] = (byCat.get(cat.key) || []).slice().sort((a: Issue, b: Issue) => {
            const w = severityWeight;
            return w(a.severity) - w(b.severity);
          });

          return (
            <div key={cat.key} id={`cat-${cat.key}`} className="scroll-mt-28">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-base font-semibold">{cat.label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {issues.length} point(s) • Score {Math.max(0, Math.min(100, cat.score))}/100
                  </div>
                </div>

                <a
                  href="#top"
                  className="text-sm font-medium text-muted-foreground hover:text-slate-900"
                >
                  Retour en haut ↑
                </a>
              </div>

              <Separator className="my-4" />

              <div className="grid gap-3">
                {issues.length === 0 ? (
                  <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
                    Aucun point pour ce filtre dans cette catégorie.
                  </div>
                ) : (
                  issues.map((issue) => (
                    <details
                      key={issue.id}
                      className="group rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow p-4"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={severityBadge(issue.severity)}>
                                {severityLabel(issue.severity)}
                              </Badge>

                              {issue.effort && <Badge variant="outline">Effort {issue.effort}</Badge>}
                              {issue.module && <Badge variant="outline">{issue.module}</Badge>}
                            </div>

                            <div className="mt-2 truncate text-sm font-semibold">{issue.title}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{issue.impact}</div>
                          </div>

                          <div className="text-sm text-muted-foreground group-open:text-slate-900">
                            Détails
                            <span className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span>
                          </div>
                        </div>
                      </summary>

                      <div className="mt-4 grid gap-3 text-sm">
                        {issue.evidence && (
                          <div className="rounded-xl border bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-muted-foreground">
                              Preuve / Contexte
                            </div>
                            <div className="mt-1 whitespace-pre-wrap">{issue.evidence}</div>
                          </div>
                        )}

                        <div className="rounded-xl border bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-muted-foreground">
                            Recommandation
                          </div>
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
      </CardContent>
    </Card>
  );
}
