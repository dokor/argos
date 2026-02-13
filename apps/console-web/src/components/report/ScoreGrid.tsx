// app/report/[token]/components/ScoreGrid.tsx
import { CategoryScore } from "./types";

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function scorePill(score: number) {
  const s = clamp(score);
  if (s >= 85) return "border-muted bg-muted/30";
  if (s >= 70) return "border-muted bg-muted/30";
  if (s >= 55) return "border-muted bg-muted/30";
  return "border-muted bg-muted/30";
}

/**
 * Note: no explicit colors here to stay compatible with your design tokens.
 * If you later add severity colors in your Tailwind config, we can map them.
 */
export default function ScoreGrid({
                                    categories,
                                    globalScore,
                                  }: {
  categories: CategoryScore[];
  globalScore: number;
}) {
  const cats = [...(categories || [])].sort((a, b) => b.score - a.score);

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Scores par catégorie</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue synthétique pour prioriser. Cliquez sur une catégorie pour aller au détail.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Global</div>
          <div className="rounded-xl border bg-background px-3 py-2 text-sm font-semibold">
            {clamp(globalScore)}/100
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c: CategoryScore) => (
          <a
            key={c.key}
            href={`#cat-${encodeURIComponent(c.key)}`}
            className="group rounded-2xl border bg-background p-4 hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.issues} point(s)</div>
              </div>

              <div className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${scorePill(c.score)}`}>
                {clamp(c.score)}
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-foreground/70"
                  style={{ width: `${clamp(c.score)}%` }}
                  aria-label={`Score ${c.label}: ${clamp(c.score)}/100`}
                />
              </div>
            </div>

            <div className="mt-3 text-xs text-muted-foreground group-hover:text-foreground/80">
              Voir le détail →
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
