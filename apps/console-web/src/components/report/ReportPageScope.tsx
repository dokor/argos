import type { Report } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import { reportScope } from "./reportSummaryModel";

/** Shared by the reader, method and both print exports. Display URLs are never replay credentials. */
export default function ReportPageScope({ report, lang }: { report: Report; lang: Lang }) {
  const fr = lang === "fr";
  const identity = report.pageIdentity;
  return <>
    <p>{fr ? "Page demandée" : "Requested page"}: {reportScope(identity?.requested ?? report.url) ?? (fr ? "Inconnue" : "Unknown")}</p>
    {identity?.destination && <p>{identity.redirected
      ? (fr ? "Destination après redirection" : "Destination after redirect")
      : (fr ? "Page mesurée" : "Measured page")}: {reportScope(identity.destination)}</p>}
    {!identity?.destination && <p>{fr ? "Destination mesurée non conservée." : "Measured destination was not retained."}</p>}
    {(identity?.redacted || !identity) && <p>{fr
      ? "Adresse d’affichage assainie : paramètres, fragments et segments sensibles masqués. Relance exacte indisponible depuis ce lien."
      : "Sanitized display address: parameters, fragments and sensitive segments are hidden. Exact replay is unavailable from this link."}</p>}
  </>;
}
