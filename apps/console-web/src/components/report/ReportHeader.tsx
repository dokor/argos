"use client";

import { Button } from "@/components/ui/button";

export default function ReportHeader({ domain }: Readonly<{ domain: string }>) {
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const enabled = Boolean(calendly);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-100" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">Rapport Argos</div>
            <div className="text-xs text-slate-600">{domain}</div>
          </div>
        </div>

        <Button asChild disabled={!enabled}>
          <a
            href={enabled ? calendly : "#"}
            onClick={(e) => {
              if (!enabled) e.preventDefault();
            }}
          >
            Prendre rdv pour en discuter
          </a>
        </Button>
      </div>
    </header>
  );
}