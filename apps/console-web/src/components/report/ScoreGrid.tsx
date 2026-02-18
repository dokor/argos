import { CategoryScore } from "./types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

export default function ScoreGrid({
                                    categories,
                                    globalScore,
                                  }: Readonly<{
  categories: CategoryScore[];
  globalScore: number;
}>) {
  const cats = [...(categories || [])].sort((a, b) => b.score - a.score);

  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Scores par catégorie</CardTitle>
            <CardDescription>
              Vue synthétique pour prioriser. Cliquez sur une catégorie pour aller au détail.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">Global</div>
            <Badge variant="outline" className="rounded-md px-3 py-2 text-sm">
              {clamp(globalScore)}/100
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <a
              key={c.key}
              href={`#cat-${encodeURIComponent(c.key)}`}
              className="group rounded-xl border bg-white p-4 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{c.issues} point(s)</div>
                </div>

                <Badge variant="secondary" className="shrink-0 rounded-md px-3 py-2 text-sm">
                  {clamp(c.score)}
                </Badge>
              </div>

              <div className="mt-3">
                <Progress value={clamp(c.score)} />
              </div>

              <div className="mt-3 text-xs text-muted-foreground group-hover:text-foreground/80">
                Voir le détail →
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
