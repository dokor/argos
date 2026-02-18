"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ReportFooterCta() {
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const enabled = Boolean(calendly);

  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold">Prendre rdv pour en discuter</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Un échange de 15 minutes pour prioriser les optimisations, estimer l’effort, et identifier les quick wins.
        </p>

        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
          <Button asChild disabled={!enabled} className="md:w-auto">
            <a
              href={enabled ? calendly : "#"}
              onClick={(e) => {
                if (!enabled) e.preventDefault();
              }}
            >
              Planifier un échange
            </a>
          </Button>

          {!enabled && <div className="text-xs text-muted-foreground">Lien Calendly à venir.</div>}
        </div>
      </CardContent>
    </Card>
  );
}
