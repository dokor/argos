import EditorialMeta from "./EditorialMeta";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import AuditForm from "@/components/AuditForm";
import { localizedPath, type Lang } from "@/lib/i18n/routes";
import s from "./TopicAuditPage.module.scss";
export type TopicAuditContent = { route: string; title: string; lead: string; scope: string; measures: { title: string; text: string }[]; example: { title: string; conditions: string; before: string; after?: string; interpretation: string; correction: string; verify: string }; limits: string; links: { href: string; label: string }[]; sources: { href: string; label: string }[] };
const copy = {
  fr: {
    eyebrow: "Diagnostic automatique d’une URL publique",
    auditTitle: "Analyser votre page gratuitement",
    auditIntro: "Ce formulaire lance l’audit Argos existant, avec ses quatre domaines. Les résultats comprennent les contrôles disponibles, leurs preuves et leurs limites.",
    submit: "Lancer l’audit gratuit de cette URL",
    measures: "Ce que vous pouvez lire dans le rapport",
    evidence: "Preuve illustrative",
    after: "Après correction — illustration",
    interpretation: "Lecture : ", correction: "Piste de correction : ", verify: "Vérifier ensuite : ",
    limits: "Limites à garder en tête",
    auditLink: "Analyser une URL avec ces limites en tête",
    sources: "Références officielles",
  },
  en: {
    eyebrow: "Automated checks on a public URL",
    auditTitle: "Analyze your page for free",
    auditIntro: "This form runs the existing Argos audit across its four domains. Results include the available checks, their evidence and their limits.",
    submit: "Run a free audit of this URL",
    measures: "What you can read in the report",
    evidence: "Illustrative evidence",
    after: "After correction — illustration",
    interpretation: "How to read it: ", correction: "Suggested correction: ", verify: "What to check next: ",
    limits: "Limits to keep in mind",
    auditLink: "Analyze a URL with these limits in mind",
    sources: "Official references",
  },
};

export default function TopicAuditPage({ content: c, lang = "fr" }: { content: TopicAuditContent; lang?: Lang }) {
  const t = copy[lang];
  return <div className={s.page} lang={lang}><SiteNav /><main>
    <header><p>{t.eyebrow}</p><h1>{c.title}</h1><EditorialMeta route={c.route} /><p className={s.lead}>{c.lead}</p><p>{c.scope}</p></header>
    <section id="audit" aria-labelledby="audit-title"><h2 id="audit-title">{t.auditTitle}</h2><p>{t.auditIntro}</p><AuditForm mode="public" sourceRoute={c.route} submitLabel={t.submit} /></section>
    <section aria-labelledby="measures-title"><h2 id="measures-title">{t.measures}</h2><div className={s.measures}>{c.measures.map(m => <article key={m.title}><h3>{m.title}</h3><p>{m.text}</p></article>)}</div>{(c.route === "/analyse-seo-page" || c.route === "/test-vitesse-site-web") && <p><a href={localizedPath("/ressources/audit-wordpress", lang)}>{lang === "fr" ? "Site WordPress : relier ces constats aux réglages d’indexation, au cache et au thème" : "WordPress site: connect these findings to indexing settings, caching and the theme"}</a></p>}</section>
    <section aria-labelledby="example-title"><h2 id="example-title">{c.example.title}</h2><p>{c.example.conditions}</p><h3>{t.evidence}</h3><pre>{c.example.before.replaceAll("\\n", "\n")}</pre>{c.example.after && <><h3>{t.after}</h3><pre>{c.example.after}</pre></>}<p><strong>{t.interpretation}</strong>{c.example.interpretation}</p><p><strong>{t.correction}</strong>{c.example.correction}</p><p><strong>{t.verify}</strong>{c.example.verify}</p></section>
    <section><h2>{t.limits}</h2><p>{c.limits}</p><ul>{c.links.map(link => <li key={link.href}><a href={localizedPath(link.href, lang)}>{link.label}</a></li>)}</ul><p><a href="#audit">{t.auditLink}</a></p></section>
    <section id="references"><h2>{t.sources}</h2><ul>{c.sources.map(source => <li key={source.href}><a href={source.href}>{source.label}</a></li>)}</ul></section>
  </main><SiteFooter /></div>;
}
