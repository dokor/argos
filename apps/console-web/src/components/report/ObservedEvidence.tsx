import type { ObservedEvidence as Evidence } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import { cleanEvidence } from "./findingCatalogue";
import s from "./ObservedEvidence.module.scss";

const copy = {
  fr: { title:"Éléments observés", missing:"Aucun emplacement exploitable conservé par cette collecte. Cela ne signifie pas qu’aucun élément n’est concerné.",
    source:"Source", limit:"Échantillon limité : d’autres éléments peuvent être concernés.", privacy:"Les chemins URL, paramètres, fragments, identifiants DOM et contenus HTML sont masqués. La référence distingue les ressources ; elle n’est pas une URL navigable.",
    node:"Chemin DOM observé", resource:"Origine de la ressource", ref:"Référence", first:"Site", third:"Tiers", unknown:"Attribution inconnue",
    reason:"Échec réseau", unknownReason:"Raison non collectée", type:"Type", http:"Statut HTTP", scope:"Échantillon de la collecte, pas inventaire exhaustif de la page.", initiator:"Initiateur du script non collecté." },
  en: { title:"Observed elements", missing:"No usable location retained by this collection. This does not mean that no element is affected.",
    source:"Source", limit:"Limited sample: other elements may be affected.", privacy:"URL paths, parameters, fragments, DOM identifiers and HTML contents are hidden. The reference distinguishes resources; it is not a navigable URL.",
    node:"Observed DOM path", resource:"Resource origin", ref:"Reference", first:"Site", third:"Third party", unknown:"Unknown attribution",
    reason:"Network failure", unknownReason:"Reason not collected", type:"Type", http:"HTTP status", scope:"Collection sample, not an exhaustive page inventory.", initiator:"Script initiator not collected." },
};
/** Shared by the interactive finding and the full PDF. Historical evidence is untouched. */
export default function ObservedEvidence({ evidence, lang }: {evidence?:Evidence|null;lang:Lang}) {
  if(!evidence || evidence.version!=="observed-evidence-v1") return null;
  const c=copy[lang];
  return <div className={s.evidence} data-observed-evidence>
    <p><strong>{c.title}</strong> · {c.source}: {evidence.source === "lighthouse" ? "Lighthouse" : "Runtime"}</p>
    {!evidence.items.length && <p>{c.missing}</p>}
    <ul>{evidence.items.slice(0,10).map((item,i)=><li key={i}>
      {item.kind==="element" ? <p>{c.node}: <code>{cleanEvidence(item.nodePath??"")}</code></p> : <>
        <p>{c.resource}: <code>{cleanEvidence(item.origin??"")}</code></p>
        <p>{c.ref}: <code>{/^[a-f0-9]{16}$/.test(item.resourceRef??"")?item.resourceRef:"—"}</code></p>
        <p>{item.ownership==="FIRST_PARTY"?c.first:item.ownership==="THIRD_PARTY"?c.third:c.unknown}{item.resourceType && ` · ${c.type}: ${cleanEvidence(item.resourceType)}`}</p>
        {item.status ? <p>{c.http}: {item.status}</p> : evidence.source==="runtime" && <p>{c.reason}: {item.reason ? cleanEvidence(item.reason):c.unknownReason}</p>}
        {evidence.source==="runtime" && <p>{c.initiator}</p>}
      </>}
    </li>)}</ul>
    {evidence.truncated && <p><strong>{c.limit}</strong></p>}
    <p>{c.scope}</p><p>{c.privacy}</p>
  </div>;
}
