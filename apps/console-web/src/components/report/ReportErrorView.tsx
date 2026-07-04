"use client";

import Link from "next/link";
import AuditForm from "@/components/AuditForm";
import { useLang } from "@/lib/i18n/LangContext";

export type ReportErrorKind = "notFound" | "failed";

type Props = {
  kind: ReportErrorKind;
};

/**
 * Page d'erreur dédiée d'un rapport (issue #63) : rapport introuvable
 * (token inconnu/expiré) ou analyse en échec. Propose de relancer
 * gratuitement une analyse via {@link AuditForm}.
 *
 * Stylée avec les utilitaires Tailwind/shadcn (bg-card, text-muted-foreground…)
 * afin de suivre automatiquement le thème clair/sombre.
 */
export default function ReportErrorView({ kind }: Props) {
  const { t } = useLang();
  const tu = t.report.unavailable;
  const copy = kind === "failed" ? tu.failed : tu.notFound;
  const icon = kind === "failed" ? "⚠️" : "🔍";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 text-center">
      <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
        <div className="text-4xl" aria-hidden>{icon}</div>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>

        <div className="mt-8 border-t pt-6 text-left">
          <h2 className="text-base font-semibold text-foreground">{tu.rerunTitle}</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{tu.rerunHint}</p>
          <AuditForm />
        </div>

        <Link
          href="/"
          className="mt-6 inline-block rounded-xl border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          {tu.backHome}
        </Link>
      </div>
    </div>
  );
}
