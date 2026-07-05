"use client";

import { useLang } from "@/lib/i18n/LangContext";
import { Report } from "./types";
import s from "./AntiBotNotice.module.scss";

/**
 * Bandeau signalant qu'une protection anti-bot a été détectée (issue #195) :
 * l'analyse a porté sur la page de challenge et peut être partielle. N'affiche
 * rien si aucune protection n'a été détectée.
 */
export default function AntiBotNotice({ antiBot }: { antiBot: Report["antiBot"] }) {
  const { t } = useLang();
  if (!antiBot?.detected) return null;

  const ta = t.report.antiBot;
  const vendor = antiBot.vendor
    ? antiBot.vendor.charAt(0).toUpperCase() + antiBot.vendor.slice(1)
    : null;

  return (
    <div className={s.notice} role="status">
      <span className={s.icon} aria-hidden="true">🛡️</span>
      <div className={s.body}>
        <p className={s.title}>
          {ta.title}
          {vendor ? ` — ${vendor}` : ""}
        </p>
        <p className={s.description}>{ta.description}</p>
      </div>
    </div>
  );
}
