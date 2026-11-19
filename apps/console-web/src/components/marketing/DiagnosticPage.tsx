import { localizeValue, localizedCopy } from "@/lib/i18n/messages";
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
  const c = localizedCopy(diagnosticPages[topic], lang);
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
                  <div><p>{check.text}</p><p><strong>{(lang === "fr" ? "À vérifier : " : localizeValue("Next check: ", lang))}</strong>{check.next}</p>
                    {check.link && <p><Link href={linkPath(check.link.href)}>{check.link.label}</Link></p>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={s.section} aria-labelledby="example-title">
            <p className={s.eyebrow}>{(lang === "fr" ? "Exemple fictif · aucune donnée client" : localizeValue("Fictional example · no customer data", lang))}</p>
            <h2 id="example-title">{c.example.title}</h2>
            <pre className={s.evidence}><code>{c.example.evidence}</code></pre>
            <p><strong>{(lang === "fr" ? "Piste de correction : " : localizeValue("Suggested correction: ", lang))}</strong>{c.example.action}</p>
            {c.example.after && <pre className={s.evidence}><code>{c.example.after}</code></pre>}
            <p><strong>{(lang === "fr" ? "Vérifier ensuite : " : localizeValue("Verify afterwards: ", lang))}</strong>{c.example.verify}</p>
            <Link href={localizedPath("/exemple-rapport", lang)}>{(lang === "fr" ? "Lire l’exemple de rapport public et ses preuves" : localizeValue("Read the public example report and its evidence", lang))}</Link>
          </section>

          <section className={s.section} aria-labelledby="manual-title">
            <h2 id="manual-title">{c.manualTitle}</h2>
            <ol className={s.steps}>{c.manual.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p>{step.link && <p><Link href={localizedPath(step.link.href, lang)}>{step.link.label}</Link></p>}</li>)}</ol>
            {(topic === "shopify" || topic === "conversion") && <p className={s.contextLink}><Link href={localizedPath("/guides/checklist-audit-ecommerce#panier", lang)}>{(lang === "fr" ? "Pour une boutique, tester les variantes, le panier et le paiement avec la checklist e-commerce" : localizeValue("For a store, test variants, cart and checkout with the ecommerce checklist", lang))}</Link></p>}
          </section>

          <section id="limits" className={s.section} aria-labelledby="limits-title">
            <h2 id="limits-title">{(lang === "fr" ? "Les limites de ce diagnostic" : localizeValue("Limits of this diagnosis", lang))}</h2>
            <ul className={s.limits}>{c.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
            <Link href={localizedPath("/methodologie-score", lang)}>{(lang === "fr" ? "Comprendre les scores et les résultats partiels" : localizeValue("Understand scores and partial results", lang))}</Link>
          </section>

          <section id="audit" className={s.section} aria-labelledby="audit-title">
            <h2 id="audit-title">{c.cta}</h2>
            <p>{(lang === "fr" ? "Lancez l’audit technique d’une URL publique, avec ses quatre domaines : performance, sécurité, SEO et accessibilité. Le rapport et sa progression restent accessibles par un lien privé." : localizeValue("Run a technical audit of one public URL across four domains: performance, security, SEO and accessibility. The report and its progress remain accessible through a private link.", lang))}</p>
            <AuditForm mode="public" sourceRoute={route} submitLabel={c.cta} />
          </section>

          <section id="references" className={s.section} aria-labelledby="references-title">
            <h2 id="references-title">{(lang === "fr" ? "Références officielles" : localizeValue("Official references", lang))}</h2>
            <ul className={s.links}>{c.sources.map(source => <li key={source.href}><a href={source.href}>{source.label}</a></li>)}</ul>
          </section>

          <nav className={s.related} aria-label={(lang === "fr" ? "Poursuivre votre diagnostic" : localizeValue("Continue your diagnosis", lang))}>
            <h2>{(lang === "fr" ? "Poursuivre votre diagnostic" : localizeValue("Continue your diagnosis", lang))}</h2>
            <ul className={s.links}>
              {related.map(key => <li key={key}><Link href={localizedPath(diagnosticRoutes[key], lang)}>{localizedCopy(diagnosticPages[key], lang).metaTitle}</Link></li>)}
              <li><Link href={localizedPath("/guides/checklist-audit-site-web", lang)}>{(lang === "fr" ? "Checklist d’audit de site web" : localizeValue("Website audit checklist", lang))}</Link></li>
              <li><Link href={localizedPath("/ressources", lang)}>{(lang === "fr" ? "Toutes les ressources" : localizeValue("All resources", lang))}</Link></li>
            </ul>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
