// app/report/[token]/components/ReportHero.tsx
import { Report } from "./types";

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Bon";
  if (score >= 55) return "À améliorer";
  return "Prioritaire";
}

function formatDate(iso: string) {
  // iso expected, but keep it resilient
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

function getInitial(domain: string) {
  const clean = (domain || "").replace(/^www\./, "");
  return clean ? clean[0].toUpperCase() : "?";
}

export default function ReportHero({ report }: { report: Report }) {
  const title = report.site?.title || report.domain;
  const global = Math.max(0, Math.min(100, report.scores.global));
  const label = scoreLabel(global);

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Left: site identity */}
        <div className="flex items-center gap-4">
          {report.site?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.site.logoUrl}
              alt={`Logo ${report.domain}`}
              className="h-14 w-14 rounded-2xl border bg-background object-contain"
              loading="eager"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted text-lg font-semibold">
              {getInitial(report.domain)}
            </div>
          )}

          <div className="min-w-0">
            <div className="truncate text-xl font-semibold md:text-2xl">{title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="truncate">{report.domain}</span>
              <span className="hidden md:inline">•</span>
              <span className="truncate">Analysé le {formatDate(report.generatedAt)}</span>
            </div>
            <div className="mt-3 text-sm">{report.summary?.oneLiner}</div>
          </div>
        </div>

        {/* Right: score bubble */}
        <div className="flex items-center justify-between gap-4 md:justify-end">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Score global</div>
            <div className="mt-1 text-sm font-semibold">{label}</div>
          </div>

          <div className="relative grid h-16 w-16 place-items-center rounded-2xl border bg-background">
            <div className="text-lg font-semibold">{global}</div>
            <div className="absolute bottom-1 text-[10px] text-muted-foreground">/100</div>
          </div>
        </div>
      </div>

      {/* Quick context row */}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <a
          href={report.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border bg-background px-4 py-3 text-sm hover:bg-muted/30"
        >
          <div className="text-xs text-muted-foreground">URL analysée</div>
          <div className="mt-1 truncate font-medium">{report.url}</div>
        </a>

        <div className="rounded-xl border bg-background px-4 py-3 text-sm">
          <div className="text-xs text-muted-foreground">Priorités détectées</div>
          <div className="mt-1 font-medium">{report.summary?.priorities?.length ?? 0}</div>
        </div>

        <div className="rounded-xl border bg-background px-4 py-3 text-sm">
          <div className="text-xs text-muted-foreground">Points au total</div>
          <div className="mt-1 font-medium">{report.issues?.length ?? 0}</div>
        </div>
      </div>
    </section>
  );
}
