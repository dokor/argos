import type { ObservedEvidence as Evidence } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import { cleanEvidence } from "./findingCatalogue";
import s from "./ObservedEvidence.module.scss";

const metricLabels = {
  fr: { totalBytes:"Poids", wastedBytes:"Économie estimée", wastedMs:"Temps économisable estimé", transferSize:"Transfert", resourceSize:"Taille de la ressource", duration:"Durée", width:"Largeur", height:"Hauteur", navStartToEndTime:"Fin depuis la navigation", startTime:"Début depuis la navigation", sourceLine:"Ligne dans le fichier", sourceColumn:"Colonne dans le fichier" },
  en: { totalBytes:"Size", wastedBytes:"Estimated savings", wastedMs:"Estimated time savings", transferSize:"Transfer", resourceSize:"Resource size", duration:"Duration", width:"Width", height:"Height", navStartToEndTime:"End since navigation", startTime:"Start since navigation", sourceLine:"File line", sourceColumn:"File column" },
};
export function resourceLocation(item: Evidence["items"][number]) {
  if (!item.origin || !item.resourcePath || !item.resourcePath.startsWith("/") || item.resourcePath.startsWith("//")) return;
  try {
    const origin = new URL(item.origin), url = new URL(item.resourcePath, origin);
    if (!["http:","https:"].includes(url.protocol) || url.origin !== origin.origin) return;
    return cleanEvidence(url.origin + url.pathname);
  } catch { return; }
}
/** Resolve an opaque reference locally in DevTools; no request or page data is sent to Argos. */
export function resourceLookupCommand(ref?: string) {
  if (!/^[a-f0-9]{16}$/.test(ref??'')) return '';
  return `(async()=>{for(const r of performance.getEntriesByType('resource')){const u=new URL(r.name);const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(u.origin+u.pathname));if([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,16)==='${ref}')console.log(r.name)}})()`;
}
/** Locations and measurements are shown together. Old hashes are never presented as URLs. */
export default function ObservedEvidence({ evidence, lang, pageUrl }: {evidence?:Evidence|null;lang:Lang;pageUrl?:string}) {
  if (!evidence || evidence.version !== "observed-evidence-v1") return null;
  const fr = lang === "fr";
  // Source locations can repeat a bundle seven times. Keep its URL and instructions once.
  const displayed: Array<{item:Evidence['items'][number]; positions:Array<{line:number;column?:number}>}> = [];
  for (const item of evidence.items.slice(0,10)) {
    const previous = item.kind === 'resource' ? displayed.find(entry => entry.item.kind === 'resource' && entry.item.origin === item.origin && entry.item.resourceRef === item.resourceRef) : undefined;
    const line = item.metrics?.sourceLine, column = item.metrics?.sourceColumn;
    if (previous && line !== undefined) { previous.positions.push({line,column}); continue; }
    displayed.push({item,positions:line !== undefined?[{line,column}]:[]});
  }
  return <div className={s.evidence} data-observed-evidence>
    <p><strong>{fr?"Où intervenir":"Where to make the change"}</strong></p>
    {!evidence.items.length && <p>{fr?"Aucun emplacement exploitable conservé par cette collecte. Cela ne signifie pas qu’aucun élément n’est concerné.":"No usable location retained by this collection. This does not mean that no element is affected."}</p>}
    <ul>{displayed.map(({item,positions},i)=>{
      const documentLocation=item.locationScope==='ANALYSED_DOCUMENT' && pageUrl;
      const location=documentLocation ? cleanEvidence(pageUrl) : resourceLocation(item);
      const pathParts = item.nodePath?.match(/^(?:[0-9]{1,5},[A-Z][A-Z0-9-]{0,31})(?:,[0-9]{1,5},[A-Z][A-Z0-9-]{0,31})*$/) ? item.nodePath.split(',') : [];
      const indexes = pathParts.filter((_,index)=>index%2===0).map(Number);
      const exactNode = indexes.length ? `inspect([${indexes.join(',')}].reduce((n,i)=>[...n.childNodes].filter(c=>c.nodeType!==3||c.textContent.trim())[i],document))` : '';
      const lookup = !location && resourceLookupCommand(item.resourceRef);
      const binaryResource = ['image','font'].includes(item.resourceType??'') || /\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf)$/i.test(item.resourcePath??'');
      return <li key={i}>
        {item.kind==="element" ? <>
          {item.selector ? <><p>{evidence.source==='html'?(fr?'Sélecteur dans le HTML reçu':'Selector in received HTML'):evidence.source==='zap'?(fr?'Sélecteur du formulaire signalé par ZAP dans le HTML reçu':'Selector of the form flagged by ZAP in received HTML'):(fr?"Sélecteur relevé par Lighthouse":"Selector reported by Lighthouse")} : <code>{cleanEvidence(item.selector)}</code></p>
            <p>{fr?"Dans les outils de développement, ouvrez Éléments puis recherchez ce sélecteur (Ctrl/Cmd + F). Vérifiez l’élément sur la page analysée ; le sélecteur peut correspondre à plusieurs éléments.":"In developer tools, open Elements and search for this selector (Ctrl/Cmd + F). Check the element on the analysed page; the selector may match several elements."}</p></>
            : <p>{fr?"Le sélecteur exploitable n’a pas été conservé. Relancez Lighthouse sur cette page et ouvrez l’élément signalé dans le diagnostic.":"A usable selector was not retained. Run Lighthouse on this page again and open the flagged element in the diagnosis."}</p>}
          {!!exactNode && <details><summary>{fr?'Retrouver précisément cet élément':'Locate this exact element'}</summary><p>{fr?'Dans la Console des outils de développement de la page analysée, cette commande sélectionne le nœud du chemin relevé. Recharger la page si le DOM a changé.':'In the analysed page’s developer tools Console, this command selects the node at the recorded path. Reload the page if the DOM has changed.'}</p><code>{exactNode}</code></details>}
        </> : <>
          {location ? <><p>{documentLocation?(fr?'Document contenant le code':'Document containing the code'):(fr?"Ressource concernée":"Affected resource")} : <code>{location}</code></p>
            <p>{fr?"Dans Réseau, recherchez ce chemin. La colonne Initiateur permet de retrouver le HTML, la feuille de style ou le script qui le charge.":"In Network, search for this path. The Initiator column helps locate the HTML, stylesheet or script that loads it."}</p></>
            : <><p>{fr?"Origine de la ressource":"Resource origin"} : <code>{cleanEvidence(item.origin??"")}</code></p>
              <p>{fr?"Le chemin est masqué dans le rapport. Dans Réseau, filtrer cette origine et examiner l’initiateur de la requête signalée.":"The path is hidden in this report. In Network, filter this origin and inspect the flagged request’s initiator."}</p>
              {lookup && <details><summary>{fr?'Retrouver l’URL dans mon navigateur':'Find the URL in my browser'}</summary><p>{fr?'Après rechargement de la page analysée, exécuter cette commande dans sa Console. Elle compare les références et affiche localement les URL correspondantes, sans envoyer de données. Si aucune URL ne sort, la requête a changé ou n’est pas enregistrée dans la chronologie : examiner la requête en échec dans Réseau.':'After reloading the analysed page, run this command in its Console. It compares references and prints matching URLs locally, without sending data. If nothing appears, the request changed or is absent from the timeline: inspect the failed request in Network.'}</p><code>{lookup}</code></details>}</>}
          {!!positions.length&&!binaryResource&&<p>{fr?'Position signalée (ligne:colonne)':'Reported position (line:column)'} : <code>{positions.map(pos=>`${pos.line}:${pos.column??'—'}`).join(', ')}</code>. {fr?'Dans Sources, ouvrir cette position et modifier le module source correspondant. Si la console signale un échec de chargement, corriger l’URL dans l’initiateur réseau.':'In Sources, open this position and change the corresponding source module. If Console reports a failed load, fix the URL in its network initiator.'}</p>}
          <dl>{Object.entries(item.metrics??{}).filter(([key,value])=>!key.startsWith('source')&&Object.hasOwn(metricLabels[lang],key)&&typeof value==="number"&&Number.isFinite(value)&&value>=0).map(([key,value])=>{
            const bytes=/Bytes$|Size$/.test(key), millis=["duration","wastedMs","navStartToEndTime","startTime"].includes(key);
            return <div key={key}><dt>{metricLabels[lang][key as keyof typeof metricLabels.fr]}</dt><dd>{(bytes?value!/1000:value!).toLocaleString(lang,{maximumFractionDigits:1})} {bytes?(fr?"Ko":"kB"):millis?"ms":key.startsWith("source")?"":"px"}</dd></div>;
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
