import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import AuditForm from "@/components/AuditForm";
import s from "./TopicAuditPage.module.scss";
export type TopicAuditContent = { route: string; title: string; lead: string; scope: string; measures: { title: string; text: string }[]; example: { title: string; conditions: string; before: string; after?: string; interpretation: string; correction: string; verify: string }; limits: string; links: { href: string; label: string }[]; sources: { href: string; label: string }[] };
export default function TopicAuditPage({ content: c }: { content: TopicAuditContent }) { return <div className={s.page} lang="fr"><SiteNav /><main>
  <header><p>Diagnostic automatique d’une URL publique</p><h1>{c.title}</h1><p className={s.lead}>{c.lead}</p><p>{c.scope}</p></header>
  <section id="audit" aria-labelledby="audit-title"><h2 id="audit-title">Analyser votre page gratuitement</h2><p>Ce formulaire lance l’audit Argos existant, avec ses quatre domaines. Les résultats comprennent les contrôles disponibles, leurs preuves et leurs limites.</p><AuditForm mode="public" sourceRoute={c.route} submitLabel="Lancer l’audit gratuit de cette URL" /></section>
  <section aria-labelledby="measures-title"><h2 id="measures-title">Ce que vous pouvez lire dans le rapport</h2><div className={s.measures}>{c.measures.map(m=><article key={m.title}><h3>{m.title}</h3><p>{m.text}</p></article>)}</div></section>
  <section aria-labelledby="example-title"><h2 id="example-title">{c.example.title}</h2><p>{c.example.conditions}</p><h3>Preuve illustrative</h3><pre>{c.example.before}</pre>{c.example.after&&<><h3>Après correction — illustration</h3><pre>{c.example.after}</pre></>}<p><strong>Lecture : </strong>{c.example.interpretation}</p><p><strong>Piste de correction : </strong>{c.example.correction}</p><p><strong>Vérifier ensuite : </strong>{c.example.verify}</p></section>
  <section><h2>Limites à garder en tête</h2><p>{c.limits}</p><ul>{c.links.map(link=><li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul><p><a href="#audit">Analyser une URL avec ces limites en tête</a></p></section>
  <section><h2>Références officielles</h2><ul>{c.sources.map(source=><li key={source.href}><a href={source.href}>{source.label}</a></li>)}</ul></section>
</main><SiteFooter fixedFrench /></div>; }
