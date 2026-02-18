"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ReportFooterCta() {
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const enabled = Boolean(calendly);

  return (
    <section className="w-full border-t bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Card className="rounded-2xl shadow-sm bg-white/80 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Planifier un échange</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                  15 minutes pour prioriser les optimisations, estimer l’effort, et identifier les quick wins.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button asChild disabled={!enabled}>
                  <a
                    href={enabled ? calendly : "#"}
                    onClick={(e) => {
                      if (!enabled) e.preventDefault();
                    }}
                  >
                    Prendre RDV
                  </a>
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(window.location.href);
                    } catch {
                    }
                  }}
                >
                  Copier le lien
                </Button>

                {!enabled && (
                  <div className="text-xs text-muted-foreground">
                    Lien Calendly à venir.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Rapport privé • non indexable • généré automatiquement
        </div>
      </div>
    </section>
  );
}
