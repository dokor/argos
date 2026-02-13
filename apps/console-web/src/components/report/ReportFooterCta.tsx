export default function ReportFooterCta() {
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const enabled = Boolean(calendly);

  return (
    <section className="mt-10 rounded-2xl border bg-muted/30 p-6">
      <h2 className="text-lg font-semibold">Prendre rdv pour en discuter</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Un échange de 15 minutes pour prioriser les optimisations, estimer l’effort, et identifier les quick wins.
      </p>

      <div className="mt-4">
        <a
          href={enabled ? calendly : "#"}
          onClick={(e) => {
            if (!enabled) e.preventDefault();
          }}
          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold md:w-auto ${
            enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
          aria-disabled={!enabled}
        >
          Planifier un échange
        </a>
        {!enabled && (
          <div className="mt-2 text-xs text-muted-foreground">
            Lien Calendly à venir.
          </div>
        )}
      </div>
    </section>
  );
}
