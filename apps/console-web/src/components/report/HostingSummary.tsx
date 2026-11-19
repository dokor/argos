"use client";
import { localizeValue } from "@/lib/i18n/messages";
import type { Report, HostingProvider } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./HostingSummary.module.scss";

export default function HostingSummary({ report }: { report: Report }) {
  const { lang } = useLang(), hosting = report.tech?.hosting;
  if (!hosting) return null;
  const unknown = (lang === "fr" ? "Inconnu" : localizeValue("Unknown", lang));
  const provider = (value: HostingProvider | null) => value ? <>{value.name} · {(lang === "fr" ? "confiance moyenne" : localizeValue("medium confidence", lang))}<small>{value.evidence.map(item => (lang === "fr" ? item.replace(" present", " présent") : localizeValue(item, lang))).join(" · ")}</small></> : unknown;
  return <section className={s.section} aria-labelledby="hosting-heading"><h2 id="hosting-heading">{(lang === "fr" ? "Hébergement observé" : localizeValue("Observed hosting", lang))}</h2>
    <dl><div><dt>{(lang === "fr" ? "Hébergeur applicatif probable" : localizeValue("Probable application host", lang))}</dt><dd>{provider(hosting.applicationHost)}</dd></div>
      <div><dt>CDN / proxy</dt><dd>{hosting.cdnProxies.length ? hosting.cdnProxies.map(item => <span key={item.name}>{provider(item)}</span>) : unknown}</dd></div>
      <div><dt>{(lang === "fr" ? "Fournisseur réseau" : localizeValue("Network provider", lang))}</dt><dd>{provider(hosting.networkProvider)}</dd></div></dl>
    <p>{(lang === "fr" ? "Indices issus des en-têtes de cette réponse HTTP. Ils peuvent être modifiés et ne prouvent ni l’origine physique ni son emplacement. Un CDN ne permet pas d’identifier l’hébergeur masqué." : localizeValue("Signals from this HTTP response’s headers. They can be modified and do not prove the physical origin or its location. A CDN does not identify a hidden host.", lang))}</p>
    {hosting.originStatus === "CONFLICTING_SIGNALS" && <p>{(lang === "fr" ? "Plusieurs plateformes sont signalées : hébergeur indéterminé." : localizeValue("Conflicting platform signals: host undetermined.", lang))}</p>}
  </section>;
}
