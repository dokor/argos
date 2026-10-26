import Link from "@/components/PageLink";
import AuditForm from "@/components/AuditForm";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { localizedPath, type Lang } from "@/lib/i18n/routes";
import EditorialMeta from "./EditorialMeta";
import { diagnosticPages, diagnosticRoutes, type DiagnosticTopic } from "./diagnosticPages";
import s from "./DiagnosticPage.module.scss";

// The editorial content is rendered on the server; only the existing chrome and
// audit form need their client contexts and interactions.
export default function DiagnosticPage({ topic, lang }: { topic: DiagnosticTopic; lang: Lang }) {
  const c = diagnosticPages[topic][lang];
  const fr = lang === "fr";
  const route = diagnosticRoutes[topic];
  const linkPath = (href: string) => href.startsWith("#") ? href : localizedPath(href, lang);
  const related = (Object.keys(diagnosticRoutes) as DiagnosticTopic[]).filter(key => key !== topic);

  return (
    <div className={s.page}>
      <SiteNav />
      <main>
        <header className={s.hero}>
          <div className={s.container}>
            <p className={s.eyebrow}>{c.eyebrow}</p>
            <h1>{c.title}</h1>
            <EditorialMeta route={route} />
            <p className={s.lead}>{c.lead}</p>
            <p className={s.scope}>{c.scope}</p>
            <a className={s.cta} href="#audit">{c.cta}</a>
          </div>
        </header>

        <div className={s.container}>
          <section className={s.section} aria-labelledby="checks-title">
            <h2 id="checks-title">{c.checksTitle}</h2>
            <div className={s.checks}>
              {c.checks.map(check => (
                <article className={s.check} key={check.title}>
                  <h3>{check.title}</h3>
                  <div><p>{check.text}</p><p><strong>{fr ? "À vérifier : " : "Next check: "}</strong>{check.next}</p>
                    {check.link && <p><Link href={linkPath(check.link.href)}>{check.link.label}</Link></p>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={s.section} aria-labelledby="example-title">
            <p className={s.eyebrow}>{fr ? "Exemple fictif · aucune donnée client" : "Fictional example · no customer data"}</p>
            <h2 id="example-title">{c.example.title}</h2>
            <pre className={s.evidence}><code>{c.example.evidence}</code></pre>
            <p><strong>{fr ? "Piste de correction : " : "Suggested correction: "}</strong>{c.example.action}</p>
            {c.example.after && <pre className={s.evidence}><code>{c.example.after}</code></pre>}
            <p><strong>{fr ? "Vérifier ensuite : " : "Verify afterwards: "}</strong>{c.example.verify}</p>
            <Link href={localizedPath("/exemple-rapport", lang)}>{fr ? "Lire l’exemple de rapport public et ses preuves" : "Read the public example report and its evidence"}</Link>
          </section>

          <section className={s.section} aria-labelledby="manual-title">
            <h2 id="manual-title">{c.manualTitle}</h2>
            <ol className={s.steps}>{c.manual.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p>{step.link && <p><Link href={localizedPath(step.link.href, lang)}>{step.link.label}</Link></p>}</li>)}</ol>
            {(topic === "shopify" || topic === "conversion") && <p className={s.contextLink}><Link href={localizedPath("/guides/checklist-audit-ecommerce#panier", lang)}>{fr ? "Pour une boutique, tester les variantes, le panier et le paiement avec la checklist e-commerce" : "For a store, test variants, cart and checkout with the ecommerce checklist"}</Link></p>}
          </section>

          <section id="limits" className={s.section} aria-labelledby="limits-title">
            <h2 id="limits-title">{fr ? "Les limites de ce diagnostic" : "Limits of this diagnosis"}</h2>
            <ul className={s.limits}>{c.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
            <Link href={localizedPath("/methodologie-score", lang)}>{fr ? "Comprendre les scores et les résultats partiels" : "Understand scores and partial results"}</Link>
          </section>

          <section id="audit" className={s.section} aria-labelledby="audit-title">
            <h2 id="audit-title">{c.cta}</h2>
            <p>{fr ? "Lancez l’audit technique d’une URL publique, avec ses quatre domaines : performance, sécurité, SEO et accessibilité. Le rapport et sa progression restent accessibles par un lien privé." : "Run a technical audit of one public URL across four domains: performance, security, SEO and accessibility. The report and its progress remain accessible through a private link."}</p>
            <AuditForm mode="public" sourceRoute={route} submitLabel={c.cta} />
          </section>

          <section id="references" className={s.section} aria-labelledby="references-title">
            <h2 id="references-title">{fr ? "Références officielles" : "Official references"}</h2>
            <ul className={s.links}>{c.sources.map(source => <li key={source.href}><a href={source.href}>{source.label}</a></li>)}</ul>
          </section>

          <nav className={s.related} aria-label={fr ? "Poursuivre votre diagnostic" : "Continue your diagnosis"}>
            <h2>{fr ? "Poursuivre votre diagnostic" : "Continue your diagnosis"}</h2>
            <ul className={s.links}>
              {related.map(key => <li key={key}><Link href={localizedPath(diagnosticRoutes[key], lang)}>{diagnosticPages[key][lang].metaTitle}</Link></li>)}
              <li><Link href={localizedPath("/guides/checklist-audit-site-web", lang)}>{fr ? "Checklist d’audit de site web" : "Website audit checklist"}</Link></li>
              <li><Link href={localizedPath("/ressources", lang)}>{fr ? "Toutes les ressources" : "All resources"}</Link></li>
            </ul>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
