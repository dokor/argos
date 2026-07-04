"use client";

import Link from "next/link";
import AuditForm from "@/components/AuditForm";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ReportErrorView.module.scss";

export type ReportErrorKind = "notFound" | "failed";

type Props = {
  kind: ReportErrorKind;
};

/**
 * Page d'erreur dédiée d'un rapport (issue #63) : rapport introuvable
 * (token inconnu/expiré) ou analyse en échec. Propose de relancer
 * gratuitement une analyse via {@link AuditForm}.
 *
 * Stylée en SCSS Modules avec les tokens sémantiques --argos-* (théma-aware
 * clair/sombre). Cf. #124 (retrait de Tailwind/shadcn).
 */
export default function ReportErrorView({ kind }: Props) {
  const { t } = useLang();
  const tu = t.report.unavailable;
  const copy = kind === "failed" ? tu.failed : tu.notFound;
  const icon = kind === "failed" ? "⚠️" : "🔍";

  return (
    <div className={s.wrapper}>
      <div className={s.card}>
        <div className={s.icon} aria-hidden>{icon}</div>
        <h1 className={s.title}>{copy.title}</h1>
        <p className={s.description}>{copy.description}</p>

        <div className={s.rerun}>
          <h2 className={s.rerunTitle}>{tu.rerunTitle}</h2>
          <p className={s.rerunHint}>{tu.rerunHint}</p>
          <AuditForm />
        </div>

        <Link href="/" className={s.backHome}>
          {tu.backHome}
        </Link>
      </div>
    </div>
  );
}
