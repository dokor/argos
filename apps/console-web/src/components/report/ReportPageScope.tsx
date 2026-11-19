import { localizeValue } from "@/lib/i18n/messages";
import type { Report } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import { reportScope } from "./reportSummaryModel";

/** Shared by the reader, method and both print exports. Display URLs are never replay credentials. */
export default function ReportPageScope({ report, lang }: { report: Report; lang: Lang }) {
  const identity = report.pageIdentity;
  return <>
    <p>{(lang === "fr" ? "Page demandée" : localizeValue("Requested page", lang))}: {reportScope(identity?.requested ?? report.url) ?? ((lang === "fr" ? "Inconnue" : localizeValue("Unknown", lang)))}</p>
    {identity?.destination && <p>{identity.redirected
      ? ((lang === "fr" ? "Destination après redirection" : localizeValue("Destination after redirect", lang)))
      : ((lang === "fr" ? "Page mesurée" : localizeValue("Measured page", lang)))}: {reportScope(identity.destination)}</p>}
    {!identity?.destination && <p>{(lang === "fr" ? "Destination mesurée non conservée." : localizeValue("Measured destination was not retained.", lang))}</p>}
    {(identity?.redacted || !identity) && <p>{(lang === "fr" ? "Adresse d’affichage assainie : paramètres, fragments et segments sensibles masqués. Relance exacte indisponible depuis ce lien." : localizeValue("Sanitized display address: parameters, fragments and sensitive segments are hidden. Exact replay is unavailable from this link.", lang))}</p>}
  </>;
}
