"use client"

import { Report } from "./types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

function scoreLabel(score: number) {
  if (score >= 85) return { label: "Excellent", variant: "default" }
  if (score >= 70) return { label: "Bon", variant: "secondary" }
  if (score >= 55) return { label: "À améliorer", variant: "outline" }
  return { label: "Prioritaire", variant: "destructive" }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
}

function getInitial(domain: string) {
  const clean = (domain || "").replace(/^www\./, "")
  return clean ? clean[0].toUpperCase() : "?"
}

export default function ReportHero({ report }: { report: Report }) {
  const title = report.site?.title || report.domain
  const global = Math.max(0, Math.min(100, report.scores.global))
  const scoreUi = scoreLabel(global)

  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
      <CardContent className="p-6 space-y-6">

        {/* Top Section */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

          {/* Left */}
          <div className="flex items-center gap-4">
            {report.site?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={report.site.logoUrl}
                alt={`Logo ${report.domain}`}
                className="h-16 w-16 rounded-xl border bg-background object-contain"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-xl border bg-muted text-xl font-semibold">
                {getInitial(report.domain)}
              </div>
            )}

            <div className="space-y-2 min-w-0">
              <div className="truncate text-2xl font-semibold">{title}</div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{report.domain}</span>
                <Separator orientation="vertical" className="h-4 hidden md:block" />
                <span>Analysé le {formatDate(report.generatedAt)}</span>
              </div>

              <p className="text-sm text-muted-foreground max-w-xl">
                {report.summary?.oneLiner}
              </p>
            </div>
          </div>

          {/* Right Score */}
          <div className="flex flex-col items-end gap-3">
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">Score global</div>
              <Badge variant={scoreUi.variant as any}>
                {scoreUi.label}
              </Badge>
            </div>

            <div className="w-48 space-y-2">
              <Progress value={global} />
              <div className="text-right text-sm font-semibold">
                {global}/100
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Bottom Info Cards */}
        <div className="grid gap-4 md:grid-cols-3">

          <Button
            variant="outline"
            asChild
            className="justify-start h-auto py-4"
          >
            <a href={report.url} target="_blank" rel="noreferrer">
              <div className="text-left">
                <div className="text-xs text-muted-foreground">
                  URL analysée
                </div>
                <div className="font-medium truncate">
                  {report.url}
                </div>
              </div>
            </a>
          </Button>

          <Card className="p-4">
            <div className="text-xs text-muted-foreground">
              Priorités détectées
            </div>
            <div className="mt-1 font-semibold text-lg">
              {report.summary?.priorities?.length ?? 0}
            </div>
          </Card>

        <Card className="p-4">
            <div className="text-xs text-muted-foreground">
              Points au total
            </div>
            <div className="mt-1 font-semibold text-lg">
              {report.issues?.length ?? 0}
            </div>
          </Card>

        </div>

      </CardContent>
    </Card>
  )
}
