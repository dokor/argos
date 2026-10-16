"use client";
import type { Report, HostingProvider } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./HostingSummary.module.scss";

export default function HostingSummary({ report }: { report: Report }) {
  const { lang } = useLang(), fr = lang === "fr", hosting = report.tech?.hosting;
  if (!hosting) return null;
  const unknown = fr ? "Inconnu" : "Unknown";
  const provider = (value: HostingProvider | null) => value ? <>{value.name} · {fr ? "confiance moyenne" : "medium confidence"}<small>{value.evidence.map(item => fr ? item.replace(" present", " présent") : item).join(" · ")}</small></> : unknown;
  return <section className={s.section} aria-labelledby="hosting-heading"><h2 id="hosting-heading">{fr ? "Hébergement observé" : "Observed hosting"}</h2>
    <dl><div><dt>{fr ? "Hébergeur applicatif probable" : "Probable application host"}</dt><dd>{provider(hosting.applicationHost)}</dd></div>
      <div><dt>CDN / proxy</dt><dd>{hosting.cdnProxies.length ? hosting.cdnProxies.map(item => <span key={item.name}>{provider(item)}</span>) : unknown}</dd></div>
      <div><dt>{fr ? "Fournisseur réseau" : "Network provider"}</dt><dd>{provider(hosting.networkProvider)}</dd></div></dl>
    <p>{fr ? "Indices issus des en-têtes de cette réponse HTTP. Ils peuvent être modifiés et ne prouvent ni l’origine physique ni son emplacement. Un CDN ne permet pas d’identifier l’hébergeur masqué." : "Signals from this HTTP response’s headers. They can be modified and do not prove the physical origin or its location. A CDN does not identify a hidden host."}</p>
    {hosting.originStatus === "CONFLICTING_SIGNALS" && <p>{fr ? "Plusieurs plateformes sont signalées : hébergeur indéterminé." : "Conflicting platform signals: host undetermined."}</p>}
  </section>;
}
