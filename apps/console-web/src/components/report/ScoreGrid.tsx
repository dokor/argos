"use client";

import { CategoryScore } from "./types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function clamp(n: number) {
  return Math.max(0, Math.min(100, n ?? 0));
}

function scoreVariant(score: number) {
  const s = clamp(score);
  if (s >= 85) return "default" as const;
  if (s >= 70) return "secondary" as const;
  if (s >= 55) return "outline" as const;
  return "destructive" as const;
}

export default function ScoreGrid({
                                    categories,
                                    globalScore,
                                  }: {
  categories: CategoryScore[];
  globalScore: number;
}) {
  const cats = [...(categories || [])].sort((a, b) => b.score - a.score);
  const global = clamp(globalScore);

  return (
    <TooltipProvider>
      <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
        <CardHeader className="space-y-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-lg">Scores par catégorie</CardTitle>
              <CardDescription>
                Vue synthétique pour prioriser. Clique sur une catégorie pour aller au détail.
              </CardDescription>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">Global</div>
                  <Badge variant={scoreVariant(global)}>{global}/100</Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Score global agrégé (0–100) basé sur les points détectés.
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cats.map((c) => {
              const s = clamp(c.score);
              return (
                <a
                  key={c.key}
                  href={`#cat-${encodeURIComponent(c.key)}`}
                  className="group"
                >
                  <Card className="rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{c.label}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {c.issues} point(s)
                          </div>
                        </div>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <Badge variant={scoreVariant(s)}>{s}</Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Score {c.label} : {s}/100 • {c.issues} point(s)
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <Progress value={s} />

                      <div className="text-xs text-muted-foreground group-hover:text-slate-900 transition-colors">
                        Voir le détail →
                      </div>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
