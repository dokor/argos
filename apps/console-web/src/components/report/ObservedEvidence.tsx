import type { ObservedEvidence as Evidence } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import { cleanEvidence } from "./findingCatalogue";
import s from "./ObservedEvidence.module.scss";

const metricLabels = {
  fr: { totalBytes:"Poids", wastedBytes:"Économie estimée", wastedMs:"Temps économisable estimé", transferSize:"Transfert", resourceSize:"Taille de la ressource", duration:"Durée", width:"Largeur", height:"Hauteur" },
  en: { totalBytes:"Size", wastedBytes:"Estimated savings", wastedMs:"Estimated time savings", transferSize:"Transfer", resourceSize:"Resource size", duration:"Duration", width:"Width", height:"Height" },
};
export function resourceLocation(item: Evidence["items"][number]) {
  if (!item.origin || !item.resourcePath || !item.resourcePath.startsWith("/") || item.resourcePath.startsWith("//")) return;
  try {
    const origin = new URL(item.origin), url = new URL(item.resourcePath, origin);
    if (!["http:","https:"].includes(url.protocol) || url.origin !== origin.origin) return;
    return cleanEvidence(url.origin + url.pathname);
  } catch { return; }
}
/** Locations and measurements are shown together. Old hashes are never presented as URLs. */
export default function ObservedEvidence({ evidence, lang }: {evidence?:Evidence|null;lang:Lang}) {
  if (!evidence || evidence.version !== "observed-evidence-v1") return null;
  const fr = lang === "fr";
  return <div className={s.evidence} data-observed-evidence>
    <p><strong>{fr?"Où intervenir":"Where to make the change"}</strong></p>
    {!evidence.items.length && <p>{fr?"Aucun emplacement exploitable conservé par cette collecte. Cela ne signifie pas qu’aucun élément n’est concerné.":"No usable location retained by this collection. This does not mean that no element is affected."}</p>}
    <ul>{evidence.items.slice(0,10).map((item,i)=>{
      const location=resourceLocation(item);
      return <li key={i}>
        {item.kind==="element" ? <>
          {item.selector ? <><p>{fr?"Sélecteur relevé par Lighthouse":"Selector reported by Lighthouse"} : <code>{cleanEvidence(item.selector)}</code></p>
            <p>{fr?"Dans les outils de développement, ouvrez Éléments puis recherchez ce sélecteur (Ctrl/Cmd + F). Vérifiez l’élément sur la page analysée ; le sélecteur peut correspondre à plusieurs éléments.":"In developer tools, open Elements and search for this selector (Ctrl/Cmd + F). Check the element on the analysed page; the selector may match several elements."}</p></>
            : <p>{fr?"Le sélecteur exploitable n’a pas été conservé. Relancez Lighthouse sur cette page et ouvrez l’élément signalé dans le diagnostic.":"A usable selector was not retained. Run Lighthouse on this page again and open the flagged element in the diagnosis."}</p>}
          {item.nodePath && <details><summary>{fr?"Chemin DOM de la collecte":"Collected DOM path"}</summary><code>{cleanEvidence(item.nodePath)}</code></details>}
        </> : <>
          {location ? <><p>{fr?"Ressource concernée":"Affected resource"} : <code>{location}</code></p>
            <p>{fr?"Dans Réseau, recherchez ce chemin. La colonne Initiateur permet de retrouver le HTML, la feuille de style ou le script qui le charge.":"In Network, search for this path. The Initiator column helps locate the HTML, stylesheet or script that loads it."}</p></>
            : <><p>{fr?"Origine de la ressource":"Resource origin"} : <code>{cleanEvidence(item.origin??"")}</code></p>
              <p>{fr?"Le chemin du fichier n’est pas disponible dans ce rapport. Relancez l’analyse pour le recueillir ; certains chemins sensibles restent masqués.":"The file path is unavailable in this report. Run the analysis again to collect it; sensitive paths remain hidden."}</p></>}
          <dl>{Object.entries(item.metrics??{}).filter(([key,value])=>Object.hasOwn(metricLabels[lang],key)&&typeof value==="number"&&Number.isFinite(value)&&value>=0).map(([key,value])=>{
            const bytes=/Bytes$|Size$/.test(key), millis=key==="duration"||key==="wastedMs";
            return <div key={key}><dt>{metricLabels[lang][key as keyof typeof metricLabels.fr]}</dt><dd>{(bytes?value!/1000:value!).toLocaleString(lang,{maximumFractionDigits:1})} {bytes?(fr?"Ko":"kB"):millis?"ms":"px"}</dd></div>;
          })}</dl>
          {item.status && <p>{fr?"Statut HTTP":"HTTP status"} : {item.status}</p>}
          {item.reason && <p>{fr?"Échec réseau":"Network failure"} : {cleanEvidence(item.reason)}</p>}
          <details><summary>{fr?"Référence de collecte":"Collection reference"}</summary><code>{/^[a-f0-9]{16}$/.test(item.resourceRef??"")?item.resourceRef:"—"}</code></details>
        </>}
      </li>;
    })}</ul>
    {evidence.truncated && <p><strong>{fr?"Échantillon limité : d’autres éléments peuvent être concernés.":"Limited sample: other elements may be affected."}</strong></p>}
    <p>{fr?"Emplacements observés lors de cette analyse. Les paramètres URL et contenus sensibles sont masqués.":"Locations observed during this analysis. URL parameters and sensitive content are hidden."}
      {evidence.items.some(item=>item.metrics?.wastedBytes!==undefined||item.metrics?.wastedMs!==undefined)
        && (fr?" Les économies sont des estimations Lighthouse, pas une promesse de gain.":" Savings are Lighthouse estimates, not guaranteed improvements.")}</p>
  </div>;
}
