"use client";

import Link from "@/components/LocalizedLink";
import AuditForm from "@/components/AuditForm";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import EditorialMeta from "./EditorialMeta";
import EcommerceCartExample from "./EcommerceCartExample";
import EcommerceAuditWorksheet from "./EcommerceAuditWorksheet";
import { useLang } from "@/lib/i18n/LangContext";
import { ecommerceAuditCopy, ecommerceAuditRoute, ecommerceAuditSources } from "@/lib/ecommerceAuditGuide";
import s from "./EcommerceAuditGuide.module.scss";

export default function EcommerceAuditGuide() {
  const { lang } = useLang();
  const c = ecommerceAuditCopy[lang];
  const fr = lang === "fr";
  return (
    <div className={s.page}>
      <SiteNav />
      <main>
        <article>
          <header className={s.hero}>
            <div className={s.container}>
              <p className={s.eyebrow}>{c.eyebrow}</p>
              <h1>{c.title}</h1>
              <EditorialMeta route={ecommerceAuditRoute} />
              <p className={s.lead}>{c.lead}</p>
              <p className={s.scope}>{c.scope}</p>
            </div>
          </header>
          <div className={s.container}>
            <nav className={s.contents} aria-label={c.contents}>
              <h2>{c.contents}</h2>
              <ol>{c.steps.map(step => <li key={step.id}><a href={`#${step.id}`}>{step.title}</a></li>)}</ol>
              <p><a href="#example-title">{fr ? "Essayer le scénario de variante" : "Try the variant scenario"}</a> · <a href="#grille-controle">{fr ? "Utiliser la grille de contrôle" : "Use the audit worksheet"}</a></p>
            </nav>
            {c.steps.map((step, index) => (
              <section className={s.step} id={step.id} aria-labelledby={`${step.id}-title`} key={step.id}>
                <p className={s.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</p>
                <h2 id={`${step.id}-title`}>{step.title}</h2>
                <dl>{(["check", "evidence", "action"] as const).map(field => (
                  <div key={field}><dt>{c.labels[field]}</dt><dd>{step[field]}</dd></div>
                ))}</dl>
                {step.id === "catalogue-seo" && <p className={s.contextLink}><Link href="/guides/checklist-audit-site-web#indexabilite">{fr ? "Reprendre les contrôles généraux d’indexabilité" : "Review general indexability checks"}</Link></p>}
                {step.id === "vitesse-mobile" && <p className={s.contextLink}><Link href="/guides/lcp-lent#diagnostic">{fr ? "Trouver ce qui retarde l’image principale avec le guide LCP" : "Find what delays the main image with the LCP guide"}</Link></p>}
                {step.id === "panier" && <p className={s.contextLink}><a href="#example-title">{fr ? "Essayer l’erreur de variante dans la simulation" : "Try the variant error in the simulation"}</a></p>}
                {step.id === "plan-action" && <p className={s.contextLink}><Link href="/ressources/pourquoi-mon-site-ne-convertit-pas">{fr ? "Distinguer défaut technique, mesure et autres causes de faible conversion" : "Separate technical failures, measurement and other causes of low conversion"}</Link></p>}
              </section>
            ))}
            <section className={s.section} aria-labelledby="example-title">
              <h2 id="example-title">{c.exampleTitle}</h2>
              <p>{c.exampleIntro}</p>
              <EcommerceCartExample lang={lang} />
              <ol>{c.priorities.map(item => <li key={item}>{item}</li>)}</ol>
              <p>{c.exampleEnd}</p>
            </section>
            <EcommerceAuditWorksheet lang={lang} />
            <section className={s.section} aria-labelledby="limits-title">
              <h2 id="limits-title">{c.limitsTitle}</h2>
              <p>{c.limits}</p>
            </section>
            <section className={s.section} aria-labelledby="faq-title">
              <h2 id="faq-title">{c.faqTitle}</h2>
              {c.faq.map(item => <div key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></div>)}
            </section>
            <section className={s.section} aria-labelledby="next-title">
              <h2 id="next-title">{c.nextTitle}</h2>
              <ul>{c.links.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
            </section>
            <section className={s.section} id="references" aria-labelledby="references-title">
              <h2 id="references-title">{c.sourcesTitle}</h2>
              <ul>{ecommerceAuditSources.map(source => <li key={source.href}><a href={source.href}>{source[lang]}</a></li>)}</ul>
            </section>
            <section className={s.cta} id="audit" aria-labelledby="audit-title">
              <h2 id="audit-title">{c.ctaTitle}</h2>
              <p>{c.cta}</p>
              <AuditForm mode="public" sourceRoute={ecommerceAuditRoute} />
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
