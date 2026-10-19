"use client";
import { useRef, useState } from "react";
import Link from "@/components/LocalizedLink";
import ArgosIcon from "@/components/ArgosIcon";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import SiteFooter from "@/components/site/SiteFooter";
import { useLang } from "@/lib/i18n/LangContext";
import catalog from "@/lib/ci-error-catalog.json";
import templates from "@/lib/ci-integration-templates.json";
import openapi from "@/lib/ci-docs-openapi.json";
import { topics, sections, text, docPath, revision, checksum, admissionCurl, type Topic } from "./content";
import s from "./DeveloperDocs.module.scss";

export function DocCode({value,label}:{value:string;label:string}){
  const {lang}=useLang(),[copied,setCopied]=useState<{value:string;ok:boolean}|null>(null);
  const tx=(fr:string,en:string)=>lang==="fr"?fr:en;
  async function copy(){try{await navigator.clipboard.writeText(value);setCopied({value,ok:true});}catch{setCopied({value,ok:false});}}
  return <div className={s.code}><div className={s.codebar}><span>{label}</span><button type="button" onClick={()=>void copy()} aria-label={tx("Copier ","Copy ")+label}>{tx("Copier","Copy")}</button></div>
    <pre tabIndex={0} role="region" aria-label={label}><code>{value}</code></pre><span className={s.copyStatus} role="status">{copied?.value===value?(copied.ok?tx("Exemple copié.","Example copied."):tx("Copie indisponible : sélectionnez le texte de l’exemple.","Copy unavailable: select the example text.")):""}</span></div>;
}
const normalize=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function Template({provider}:{provider:"github"|"gitlab"}){
  const {lang}=useLang(),[mode,setMode]=useState("standard");
  const tx=(fr:string,en:string)=>lang==="fr"?fr:en;
  const value=provider==="github"?(mode==="preview"?templates.templates.githubPreview:templates.templates.github):mode==="preview"?templates.templates.gitlabPreview:mode==="publication"?templates.templates.gitlabPublication:templates.templates.gitlab;
  return <div className={s.example}><label htmlFor="doc-template">{tx("Modèle à copier","Template to copy")}</label><select id="doc-template" value={mode} onChange={e=>setMode(e.target.value)}>
    <option value="standard">{tx("Standard · issues désactivées","Standard · issues disabled")}</option><option value="preview">{tx("PREVIEW · publication en lecture seule","PREVIEW · read-only publication")}</option>
    <option value="publication">{tx("Complet · préparer SYNC explicitement","Complete · explicitly prepare SYNC")}</option>
  </select><p>{mode==="preview"?tx("Mode JSON PREVIEW requis ; aucun credential d’écriture. Lisez la rubrique Création d’issues pour le registre et les consentements.","JSON mode PREVIEW required; no write credential. Read Issue creation for journal and consents."):tx("Ce modèle ne suffit pas à activer une publication : le mode JSON reste DISABLED et l’opt-in est indépendant. Revoir droits et secrets avant SYNC.","This template does not enable publication by itself: JSON mode stays DISABLED and opt-in is independent. Review permissions and secrets before SYNC.")}</p>
  <DocCode value={value} label={provider==="github"?".github/workflows/argos-ci.yml":".gitlab-ci.yml"}/></div>;
}
function ErrorCatalogue(){
  const {lang}=useLang(),[query,setQuery]=useState(""),[stage,setStage]=useState(""),input=useRef<HTMLInputElement>(null);
  const tx=(fr:string,en:string)=>lang==="fr"?fr:en;
  const entries=Object.entries(catalog.errors),filtered=entries.filter(([code,e])=>(!stage||e.stage===stage)&&normalize(code+" "+e[lang].message+" "+e[lang].action+" "+e.actionCode).includes(normalize(query.trim())));
  return <section id="catalog" className={s.section}><h2>{tx("Catalogue des erreurs · v1","Error catalogue · v1")}</h2>
    <div className={s.filters}><div><label htmlFor="error-search">{tx("Chercher un code ou une action","Find a code or action")}</label><input ref={input} id="error-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} /></div>
    <div><label htmlFor="error-stage">{tx("Étape","Stage")}</label><select id="error-stage" value={stage} onChange={e=>setStage(e.target.value)}><option value="">{tx("Toutes les étapes","All stages")}</option>{[...new Set(entries.map(([,e])=>e.stage))].map(v=><option key={v}>{v}</option>)}</select></div></div>
    <p role="status">{filtered.length} {tx("code(s) affiché(s)","code(s) shown")}</p>
    {filtered.length===0&&<p>{tx("Aucun code trouvé. Essayez un mot plus court ou retirez les filtres.","No code found. Try a shorter word or clear filters.")}</p>}
    {(query||stage)&&<button className={s.button} type="button" onClick={()=>{setQuery("");setStage("");input.current?.focus();}}>{tx("Effacer les filtres","Clear filters")}</button>}
    {filtered.map(([code,e])=><article id={code.toLowerCase().replaceAll("_","-")} key={code} className={s.error}>
      <h3><a href={"#"+code.toLowerCase().replaceAll("_","-")}>{code}</a></h3><p>{e[lang].message}</p><p><strong>{tx("Action sûre : ","Safe action: ")}</strong>{e[lang].action}</p>
      <dl><div><dt>HTTP</dt><dd>{e.httpStatus}</dd></div><div><dt>{tx("Étape","Stage")}</dt><dd>{e.stage}</dd></div><div><dt>{tx("Action","Action")}</dt><dd>{e.actionCode}</dd></div><div><dt>{tx("Reprise","Recovery")}</dt><dd>{e.recovery}</dd></div><div><dt>retryable</dt><dd>{String(e.retryable)}</dd></div></dl>
    </article>)}
  </section>;
}
const apiLabels:Record<string,readonly [string,string]>={
  "/analyses":["Admettre une intention","Admit an intention"],"/admissions/by-key/{key}":["Récupérer par UUID d’intention","Recover by intention UUID"],"/admissions/{id}":["Lire une admission","Read an admission"],
  "/runs/{id}":["Lire un run","Read a run"],"/runs/{id}/report":["Lire ou supprimer un rapport privé","Read or delete a private report"],"/runs/{id}/export":["Exporter les détails privés","Export private details"],
  "/usage":["Lire la consommation","Read usage"],"/preflight":["Lire le précontrôle","Read preflight"],"/identity":["Lire l’identité","Read identity"],"/policies/standard-v1":["Lire la politique","Read policy"],"/admissions/{id}/verdict":["Lire le verdict confirmé","Read confirmed verdict"],
};
function ApiReference(){
  const {lang}=useLang(),tx=(fr:string,en:string)=>lang==="fr"?fr:en;
  return <section className={s.section} id="endpoints"><h2>{tx("Opérations et schémas","Operations and schemas")}</h2>
    <p><a href="/docs/openapi-v1.json" download>{tx("Télécharger OpenAPI 3.1 · JSON","Download OpenAPI 3.1 · JSON")}</a> · {openapi.info.version}</p>
    <details><summary>{tx("Première requête idempotente · curl","First idempotent request · curl")}</summary><p>{tx("Cet exemple admet deux analyses et écrit une réponse privée dans un fichier local. Le client portable reste recommandé pour valider la réponse et reprendre sûrement.","This example admits two analyses and writes a private response to a local file. The portable client is recommended for response validation and safe recovery.")}</p><DocCode value={admissionCurl} label="POST · Idempotency-Key · curl"/></details>
    {Object.entries(openapi.paths).flatMap(([path,methods])=>Object.entries(methods).map(([method,raw])=>{
      const op=raw as {responses:Record<string,unknown>;"x-required-scopes"?:string[]};
      return <div className={s.endpoint} key={method+path}><h3>{method.toUpperCase()} <code>/api/ci/v1{path}</code></h3><p>{text(apiLabels[path],lang)}</p><p>{tx("Portée : ","Scope: ")}<code>{op["x-required-scopes"]?.length?op["x-required-scopes"].join(", "):tx("clé active, aucune portée supplémentaire","active key, no additional scope")}</code> · {tx("Statuts : ","Statuses: ")}{Object.keys(op.responses).join(", ")}</p></div>;
    }))}
    <details><summary>{tx("Schémas JSON complets et bornes","Complete JSON schemas and bounds")}</summary><DocCode value={JSON.stringify(openapi.components.schemas,null,2)} label="OpenAPI · schemas"/></details>
  </section>;
}
export default function DeveloperDocs({topic="start"}:{topic?:Topic}){
  const {lang}=useLang(),tx=(fr:string,en:string)=>lang==="fr"?fr:en;
  const [query,setQuery]=useState(""),[menu,setMenu]=useState(false),search=useRef<HTMLInputElement>(null);
  const all=Object.keys(topics) as Topic[],matches=all.filter(key=>normalize(text(topics[key],lang)+" "+sections[key].map(v=>text(v.title,lang)+" "+v.paragraphs.map(p=>text(p,lang)).join(" ")).join(" ")+(key==="errors"?" "+Object.keys(catalog.errors).join(" "):"")).includes(normalize(query.trim())));
  const anchorSections=sections[topic];
  return <div className={s.page}>
    <a className={s.skip} href="#docs-main">{tx("Aller au contenu","Skip to content")}</a>
    <header className={s.header}><Link href="/" className={s.logo}><ArgosIcon size={22}/><span>Argos</span></Link>
      <nav aria-label={tx("Navigation principale","Primary navigation")}><Link href="/">{tx("Le diagnostic","Website audit")}</Link><Link href="/ressources">{tx("Guides","Guides")}</Link><Link href="/docs" aria-current="location">{tx("Développeurs","Developers")}</Link></nav>
      <div className={s.preferences}><ThemeToggle/><LangToggle/><Link className={s.account} href="/account">{tx("Mon compte","My account")}</Link></div>
    </header>
    <div className={s.layout}>
      <aside className={s.sidebar} aria-label={tx("Navigation documentaire","Documentation navigation")}>
        <button className={s.mobileMenu} type="button" aria-expanded={menu} aria-controls="docs-topics" onClick={()=>setMenu(v=>!v)}>{tx("Rubriques de la documentation","Documentation topics")} {menu?"−":"+"}</button>
        <div className={s.sidebarInner} id="docs-topics" data-open={menu} onKeyDown={e=>{if(e.key==="Escape"){setMenu(false);document.querySelector<HTMLButtonElement>('[aria-controls="docs-topics"]')?.focus();}}}>
          <label htmlFor="docs-search">{tx("Rechercher dans les guides","Search the guides")}</label><input ref={search} id="docs-search" type="search" value={query} onChange={e=>setQuery(e.target.value)}/>
          {query&&<><p role="status">{matches.length} {tx("rubrique(s)","topic(s)")}</p><button type="button" className={s.reset} onClick={()=>{setQuery("");search.current?.focus();}}>{tx("Effacer","Clear")}</button></>}
          {matches.length===0&&<p>{tx("Aucune rubrique trouvée.","No topics found.")}</p>}
          <nav aria-label={tx("Rubriques","Topics")}>{(["start","github","api"] as const).map((first,i)=><div key={first}>
            <p className={s.group}>{[tx("Commencer","Get started"),tx("Intégration continue","Continuous integration"),tx("Référence","Reference")][i]}</p>
            {(i===0?all.slice(0,3):i===1?all.slice(3,6):all.slice(6)).filter(v=>matches.includes(v)).map(key=><a key={key} href={docPath(key,lang)} aria-current={key===topic?"page":undefined} onClick={()=>setMenu(false)}>{text(topics[key],lang)}</a>)}
          </div>)}</nav><p className={s.sidebarNote}>{tx("Documentation publique · sans compte","Public documentation · no account required")}<br/>API v1 · {tx("aperçu","preview")}</p>
        </div>
      </aside>
      <main className={s.main} id="docs-main" tabIndex={-1}>
        <p className={s.eyebrow}>{tx("Documentation développeur","Developer documentation")}</p><h1>{text(topics[topic],lang)}</h1>
        <p className={s.lead}>{tx("Intégrez un contrôle Argos à votre pipeline et retrouvez un diagnostic privé après déploiement.","Integrate an Argos control into your pipeline and read a private diagnosis after deployment.")}</p>
        <div className={s.meta}><span>API v1 · {tx("aperçu","preview")}</span><span>Client {templates.clientVersion}</span><span>FR / EN</span></div>
        <p className={s.notice}><strong>{tx("Accès CI désactivé.","CI access disabled.")}</strong> {tx("Ouverture après la recette complète #467. Les exemples préparent votre intégration ; ils ne l’activent pas.","Opening follows full acceptance #467. Examples prepare your integration; they do not activate it.")} <a href={docPath("changelog",lang)}>{tx("Compatibilité et statut","Compatibility and status")} →</a></p>
        <details className={s.mobileToc}><summary>{tx("Sur cette page","On this page")}</summary><ul>{anchorSections.map(v=><li key={v.id}><a href={"#"+v.id}>{text(v.title,lang)}</a></li>)}</ul></details>
        {anchorSections.map(v=><section className={s.section} key={v.id} id={v.id}><h2>{text(v.title,lang)}</h2>{v.paragraphs.map((p,i)=><p key={i}>{text(p,lang)}</p>)}
          {v.code&&<DocCode value={v.code} label={v.label??text(v.title,lang)}/>}
          {(topic==="github"||topic==="gitlab")&&v.id==="template"&&<Template provider={topic}/>}
          {topic==="issues"&&v.id==="configuration"&&(["github","gitlab"] as const).map(provider=><details key={provider}><summary>{provider==="github"?"GitHub":"GitLab"} · JSON DISABLED</summary><DocCode value={JSON.stringify(templates.publication[provider],null,2)} label={"ARGOS_PUBLICATION_CONFIG · "+provider}/></details>)}
          {topic==="start"&&v.id==="verify-domain"&&<a href={docPath("domains",lang)}>{tx("Comprendre la vérification","Understand verification")} →</a>}
          {topic==="start"&&v.id==="create-key"&&<a href={docPath("auth",lang)}>{tx("Créer et protéger une clé","Create and protect a key")} →</a>}
        </section>)}
        {topic==="errors"&&<ErrorCatalogue/>}{topic==="api"&&<ApiReference/>}
        <section className={s.next}><h2>{tx("Continuer l’intégration","Continue integration")}</h2><a href={docPath(topic==="start"?"github":"errors",lang)}>{text(topics[topic==="start"?"github":"errors"],lang)} →</a> · <Link href="/account/integrations">{tx("Gérer les clés et l’intégration","Manage keys and integration")}</Link></section>
        <details className={s.distribution}><summary>{tx("Distribution vérifiée et provenance","Verified distribution and provenance")}</summary><p>Commit <code>{revision}</code></p><p>SHA-256 <code>{checksum}</code></p><a href={"https://github.com/dokor/argos/tree/"+revision+"/clients/ci"} referrerPolicy="no-referrer">{tx("Consulter la source épinglée","Read the pinned source")}</a></details>
      </main>
      <aside className={s.toc}><nav aria-label={tx("Sur cette page","On this page")}><p>{tx("Sur cette page","On this page")}</p>{anchorSections.map(v=><a key={v.id} href={"#"+v.id}>{text(v.title,lang)}</a>)}
        {topic==="api"&&<a href="#endpoints">{tx("Opérations et schémas","Operations and schemas")}</a>}{topic==="errors"&&<a href="#catalog">{tx("Catalogue des erreurs","Error catalogue")}</a>}</nav><hr/><a href={docPath("errors",lang)}>{tx("Une difficulté ?","Need help?")} →</a></aside>
    </div><SiteFooter/>
  </div>;
}
