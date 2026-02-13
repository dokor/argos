export default function ReportHeader({ domain }: { domain: string }) {
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const enabled = Boolean(calendly);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Rapport Argos</div>
            <div className="text-xs text-muted-foreground">{domain}</div>
          </div>
        </div>

        <a
          href={enabled ? calendly : "#"}
          onClick={(e) => {
            if (!enabled) e.preventDefault();
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${
            enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
          aria-disabled={!enabled}
        >
          Prendre rdv pour en discuter
        </a>
      </div>
    </header>
  );
}
