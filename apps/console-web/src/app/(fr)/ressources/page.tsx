"use client";

import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./page.module.scss";

const copy = {
  fr: {
    eyebrow: "Guides et diagnostics",
    title: "Ressources pour mieux auditer votre site",
    lead: "Comprenez ce qu’Argos peut mesurer sur une page publique, puis choisissez le diagnostic adapté à votre contexte. Chaque ressource précise aussi les limites de l’analyse automatique.",
    guidesTitle: "Comprendre les mesures",
    audiencesTitle: "Choisir votre contexte",
    guides: [
      { href: "/guides/checklist-audit-site-web", title: "Checklist d’audit de site web", description: "Six contrôles manuels, leurs résultats attendus et les limites de l’analyse automatique." },
      { href: "/methodologie-score", title: "Méthode du score Argos", description: "Quatre domaines, contrôles pondérés, exemple chiffré et lecture des résultats partiels." },
      { href: "/ressources/audit-technique-gratuit", title: "Audit technique gratuit", description: "Méthode, contrôles HTTP, HTML, performance et sécurité, lecture du rapport et résultats partiels." },
      { href: "/ressources/accessibilite-numerique", title: "Accessibilité numérique", description: "Comprendre le RGAA, l’EAA, les obligations et ce qui nécessite une vérification humaine." },
    ],
    audiences: [
      { href: "/ressources/audit-site-pme", title: "Audit de site PME", description: "Repérez les constats techniques utiles pour prioriser le travail sur une page clé de votre activité." },
      { href: "/ressources/audit-site-ecommerce", title: "Audit de site e-commerce", description: "Analysez une page publique de boutique, avec des limites claires sur le panier et le paiement." },
    ],
    linkLabel: "Lire la ressource",
  },
  en: {
    eyebrow: "Guides and diagnostics",
    title: "Resources to audit your website",
    lead: "Learn what Argos can measure on a public page, then choose the diagnosis that fits your context. Each resource also explains the limits of automated analysis.",
    guidesTitle: "Understand the measurements",
    audiencesTitle: "Choose your context",
    guides: [
      { href: "/guides/checklist-audit-site-web", title: "Website audit checklist", description: "Six manual checks, expected results, and the limits of automated analysis." },
      { href: "/methodologie-score", title: "Argos scoring method (French)", description: "Four domains, weighted checks, a worked example and partial results." },
      { href: "/ressources/audit-technique-gratuit", title: "Free technical audit", description: "Method, HTTP, HTML, performance and security checks, reading the report and partial results." },
      { href: "/ressources/accessibilite-numerique", title: "Digital accessibility", description: "Understand the RGAA, EAA, obligations and what requires human review." },
    ],
    audiences: [
      { href: "/ressources/audit-site-pme", title: "Small business site audit", description: "Find technical issues that can help prioritize work on an important business page." },
      { href: "/ressources/audit-site-ecommerce", title: "E-commerce site audit", description: "Examine a public store page, with clear limits around carts and payments." },
    ],
    linkLabel: "Read the resource",
  },
} as const;

export default function ResourcesPage() {
  const { lang } = useLang();
  const c = copy[lang];

  return (
    <div className={s.page}>
      <SiteNav />
      <main>
        <header className={s.hero}>
          <div className={s.container}>
            <p className={s.eyebrow}>{c.eyebrow}</p>
            <h1>{c.title}</h1>
            <p className={s.lead}>{c.lead}</p>
          </div>
        </header>
        <div className={s.container}>
          <section className={s.section} aria-labelledby="guides-title">
            <h2 id="guides-title">{c.guidesTitle}</h2>
            <div className={s.grid}>
              {c.guides.map((item) => (
                <article key={item.href} className={s.card}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <Link href={item.href} aria-label={`${c.linkLabel} : ${item.title}`}>{c.linkLabel} <span aria-hidden="true">→</span></Link>
                </article>
              ))}
            </div>
          </section>
          <section className={s.section} aria-labelledby="audiences-title">
            <h2 id="audiences-title">{c.audiencesTitle}</h2>
            <div className={s.grid}>
              {c.audiences.map((item) => (
                <article key={item.href} className={s.card}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <Link href={item.href} aria-label={`${c.linkLabel} : ${item.title}`}>{c.linkLabel} <span aria-hidden="true">→</span></Link>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
