"use client";

import { Report } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TechBadges } from "@/components/report/TechBadges";
import { useLang } from "@/lib/i18n/LangContext";

function scoreLabel(score: number, labels: { excellent: string; good: string; improve: string; priority: string }) {
  if (score >= 85) return { label: labels.excellent, variant: "default" as const };
  if (score >= 70) return { label: labels.good, variant: "secondary" as const };
  if (score >= 55) return { label: labels.improve, variant: "outline" as const };
  return { label: labels.priority, variant: "destructive" as const };
}

function formatDate(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, { dateStyle: "long", timeStyle: "short" });
}

function getInitial(domain: string) {
  const clean = (domain || "").replace(/^www\./, "");
  return clean ? clean[0].toUpperCase() : "?";
}

function ScoreRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative grid h-20 w-20 place-items-center rounded-2xl border bg-white shadow-sm"
      style={{
        background: `conic-gradient(hsl(222.2 84% 4.9%) ${v}%, hsl(210 40% 96.1%) 0)`,
      }}
    >
      <div className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-white">
        <div className="text-lg font-semibold">{v}</div>
        <div className="text-[10px] text-muted-foreground -mt-1">/100</div>
      </div>
    </div>
  );
}

export default function ReportHero({ report }: { report: Report }) {
  const { t } = useLang();
  const th = t.report.hero;
  const title = report.site?.title || report.domain;
  const global = Math.max(0, Math.min(100, report.scores.global));
  const scoreUi = scoreLabel(global, th.scoreLabels);

  const prioritiesCount = report.summary?.priorities?.length ?? 0;
  const issuesCount = report.issues?.length ?? 0;

  return (
    <TooltipProvider>
      <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
        <CardContent className="p-6 space-y-6">
          {/* Accent bar */}
          <div className="h-1 w-full rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* Identity */}
            <div className="flex items-center gap-4">
              {report.site?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={report.site.logoUrl}
                  alt={`Logo ${report.domain}`}
                  className="h-16 w-16 rounded-xl border bg-white object-contain"
                />
              ) : (
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-xl border bg-slate-50 text-xl font-semibold">
                  {getInitial(report.domain)}
                </div>
              )}

              <div className="min-w-0 space-y-2">
                <div className="truncate text-2xl font-semibold">{title}</div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{report.domain}</Badge>
                  <Badge variant="outline">{th.analyzedAt} {formatDate(report.generatedAt, th.locale)}</Badge>
                  <Badge variant="outline">{prioritiesCount} {th.priorities}</Badge>
                  <Badge variant="outline">{issuesCount} {th.issues}</Badge>
                  <TechBadges tech={report.tech} />
                </div>

                <p className="text-sm text-muted-foreground max-w-2xl">
                  {report.summary?.oneLiner}
                </p>
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center gap-4 md:justify-end">
              <div className="text-right space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <div className="text-sm text-muted-foreground">{th.scoreGlobal}</div>
                      <Badge variant={scoreUi.variant}>{scoreUi.label}</Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {th.scoreTooltip}
                  </TooltipContent>
                </Tooltip>

                <div className="w-52 space-y-2">
                  <Progress value={global} />
                  <div className="text-xs text-muted-foreground">
                    {th.scoreObjectivePrefix} {global >= 85 ? th.scoreMaintain : th.scoreQuickwins}
                  </div>
                </div>
              </div>

              <ScoreRing value={global} />
            </div>
          </div>

          <Separator />

          {/* Quick actions / context */}
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" asChild className="h-auto justify-start py-4 bg-white">
              <a href={report.url} target="_blank" rel="noreferrer">
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">{th.urlAnalyzed}</div>
                  <div className="mt-1 truncate font-medium">{report.url}</div>
                </div>
              </a>
            </Button>

            <Card className="rounded-xl border bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{th.prioritiesDetected}</div>
                <div className="mt-1 text-lg font-semibold">{prioritiesCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">{th.prioritiesFirst}</div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{th.issuesTotal}</div>
                <div className="mt-1 text-lg font-semibold">{issuesCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">{th.issuesDesc}</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
