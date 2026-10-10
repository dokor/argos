"use client";

import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { useLang } from "@/lib/i18n/LangContext";
import { languageRoutes } from "@/lib/i18n/routes";
import s from "./page.module.scss";

const copy = {
  fr: {
    eyebrow: "Guides et diagnostics",
    title: "Ressources pour mieux auditer votre site",
    lead: "Un exemple, une checklist et des guides pour comprendre vos résultats.",
    guidesTitle: "Comprendre les mesures",
    audiencesTitle: "Choisir votre contexte",
    guides: [
      { href: "/test-accessibilite-site-web", title: "Test automatique d’accessibilité", description: "Repérer des problèmes détectables et préparer les essais humains." },
      { href: "/verifier-entetes-securite", title: "Vérifier les en-têtes de sécurité", description: "Lire CSP, HSTS et les protections HTTP sans les confondre avec un pentest." },
      { href: "/analyse-seo-page", title: "Analyse SEO d’une page", description: "Vérifier les signaux HTML et préparer les corrections d’une URL." },
      { href: "/test-vitesse-site-web", title: "Test de vitesse d’une page", description: "Lire les mesures de laboratoire et lancer un audit de votre URL." },
      { href: "/exemple-rapport", title: "Exemple de rapport public", description: "Une fiche produit de démonstration contrôlée, trois preuves HTML et leurs corrections avant/après." },
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
    lead: "An example, a checklist and guides to understand your results.",
    guidesTitle: "Understand the measurements",
    audiencesTitle: "Choose your context",
    guides: [
      { href: "/exemple-rapport", title: "Public example report", description: "A controlled demo product page, three pieces of HTML evidence and before/after corrections." },
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
  const fr = lang === "fr";
  const times: Record<string, number> = { "/exemple-rapport": 7, "/guides/checklist-audit-site-web": 9, "/methodologie-score": 6, "/ressources/audit-technique-gratuit": 8, "/ressources/accessibilite-numerique": 10 };
  const languageLabel = (href: string) => !fr && !languageRoutes[href] ? " · French" : "";
  const cardMeta = (href: string) => (fr ? "Débutant · " : "Beginner · ") + (href.includes("accessibilite") ? fr ? "Accessibilité" : "Accessibility" : href.includes("score") ? fr ? "Mesures" : "Measurements" : fr ? "Diagnostic" : "Diagnosis") + (fr ? " · Lecture estimée : " : " · Estimated reading: ") + (times[href] ?? 4) + " min" + languageLabel(href);

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
          <section className={s.starter} aria-labelledby="start-title">
            <h2 id="start-title">{fr ? "Commencer ici" : "Start here"}</h2>
            <ol><li><Link href="/exemple-rapport">{fr ? "1. Lire un exemple de rapport" : "1. Read an example report"}</Link></li>
              <li><Link href="/guides/checklist-audit-site-web">{fr ? "2. Choisir les vérifications de la checklist" : "2. Choose checks from the checklist (French)"}</Link></li>
              <li><Link href="/#audit">{fr ? "3. Analyser votre page gratuitement" : "3. Analyse your page for free"}</Link></li></ol>
          </section>
          <section className={s.section} aria-labelledby="guides-title">
            <h2 id="guides-title">{c.guidesTitle}</h2>
            <div className={s.grid}>
              {c.guides.map((item) => (
                <article key={item.href} className={s.card}>
                  <h3>{item.title}</h3>
                  <p className={s.cardMeta}>{cardMeta(item.href)}</p>
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
                  <p className={s.cardMeta}>{cardMeta(item.href)}</p>
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
