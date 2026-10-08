"use client";

import Link from "next/link";
import AuditForm from "@/components/AuditForm";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ChoosingArgos from "@/components/marketing/ChoosingArgos";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./page.module.scss";

// The French version is the indexable canonical. Next prerenders this content
// into HTML; the language switch changes the copy after hydration.
const copy = {
  fr: {
    eyebrow: "Diagnostic automatisé · Sans compte",
    title: "Audit technique gratuit de votre site web",
    lead: "Entrez l’adresse d’une page publique. Argos examine les signaux techniques qu’il peut observer et rassemble les résultats dans un rapport privé, avec des pistes d’action à vérifier.",
    formTitle: "Analyser une URL",
    formHint: "HTTP ou HTTPS · Page publique · Aucun compte requis",
    methodTitle: "Comment se déroule l’audit technique ?",
    methodLead: "Le diagnostic porte sur l’URL fournie et les ressources accessibles pendant l’analyse.",
    steps: [
      { number: "01", title: "Vous indiquez une page", text: "Saisissez l’URL d’une page accessible publiquement. Les adresses locales ou privées sont refusées." },
      { number: "02", title: "Argos lance les contrôles", text: "Les modules récupèrent la réponse HTTP, lisent le HTML et, quand les services répondent, mesurent la page dans un navigateur et interrogent les outils de sécurité." },
      { number: "03", title: "Vous consultez le rapport", text: "Un lien unique ouvre la progression puis le rapport : scores par domaine, constats, éléments de preuve et actions prioritaires." },
    ],
    measuresTitle: "Ce qui est mesuré",
    measuresLead: "Les contrôles combinent plusieurs sources. Leur disponibilité dépend du site cible et des services d’analyse.",
    measures: [
      { title: "HTTP et sécurité", text: "Réponse et en-têtes HTTP, HTTPS/TLS et signaux de configuration de sécurité. Des contrôles externes, dont Observatory, SSL Labs et ZAP, peuvent enrichir le diagnostic." },
      { title: "HTML et SEO technique", text: "Balises et structure de la page, notamment titre, description et titres HTML. Ces signaux aident à repérer des points techniques, sans prédire un classement sur Google." },
      { title: "Performance", text: "Mesures du navigateur et scores Lighthouse, par exemple le chargement et le poids de page. Les résultats sont une photographie de l’exécution observée." },
      { title: "Accessibilité automatisée", text: "Alertes et score Lighthouse sur des critères détectables automatiquement. Un contrôle humain reste nécessaire pour évaluer les parcours réels et la conformité." },
    ],
    resultTitle: "Comment lire le résultat ?",
    resultText: "Le rapport regroupe les scores performance, sécurité, SEO et accessibilité, puis présente les problèmes détectés et les actions à examiner en priorité. La couverture des mesures et l’état des modules permettent de distinguer un contrôle exécuté d’un contrôle indisponible.",
    resultNote: "Un score est un indicateur de diagnostic, pas une certification ni une garantie de trafic, de sécurité ou de conformité.",
    limitsTitle: "Ce que cet audit ne couvre pas",
    limits: [
      "Une URL soumise n’équivaut pas à l’exploration complète de toutes les pages ou des espaces connectés du site.",
      "Les outils automatisés ne remplacent pas une revue humaine du SEO, de la sécurité ou de l’accessibilité.",
      "Un module peut échouer ou être ignoré si la page bloque les robots, si un service ne répond pas ou si la mesure n’est pas applicable. Le rapport peut alors être partiel.",
      "Les performances et certains signaux varient selon le moment, le réseau, le navigateur et les changements apportés au site.",
    ],
    privacyTitle: "Un rapport accessible par son lien",
    privacyText: "Aucun compte n’est nécessaire. Le rapport est accessible à toute personne possédant son lien unique ; gardez ce lien privé si les résultats sont sensibles. Les pages de rapport sont exclues de l’indexation et ne sont pas publiées comme exemples.",
    moreTitle: "Pour aller plus loin",
    moreText: "Consultez la FAQ pour les questions pratiques, et notre guide sur l’accessibilité numérique pour comprendre ce qui exige un audit humain.",
    homeLink: "Découvrir Argos",
    faqLink: "Lire la FAQ",
    scoreMethodLink: "Comprendre le calcul du score",
    accessibilityLink: "Comprendre l’accessibilité numérique",
    checklistLink: "Suivre la checklist d’audit de site web",
  },
  en: {
    eyebrow: "Automated diagnosis · No account",
    title: "Free technical audit for your website",
    lead: "Enter the address of a public page. Argos examines technical signals it can observe and gathers the results in a private report, with suggested actions to review.",
    formTitle: "Analyze a URL",
    formHint: "HTTP or HTTPS · Public page · No account required",
    methodTitle: "How does the technical audit work?",
    methodLead: "The diagnosis covers the submitted URL and resources available during the scan.",
    steps: [
      { number: "01", title: "Submit a page", text: "Enter the URL of a publicly accessible page. Local and private addresses are rejected." },
      { number: "02", title: "Argos runs the checks", text: "Modules fetch the HTTP response, inspect HTML and, when services respond, measure the page in a browser and query security tools." },
      { number: "03", title: "Read the report", text: "A unique link opens progress and then the report: scores by area, findings, evidence and priority actions." },
    ],
    measuresTitle: "What is measured",
    measuresLead: "Checks combine several sources. Availability depends on the target site and analysis services.",
    measures: [
      { title: "HTTP and security", text: "HTTP response and headers, HTTPS/TLS and security configuration signals. External checks, including Observatory, SSL Labs and ZAP, may add to the diagnosis." },
      { title: "HTML and technical SEO", text: "Page tags and structure, including title, description and HTML headings. These signals help identify technical issues but cannot predict Google rankings." },
      { title: "Performance", text: "Browser measurements and Lighthouse scores, such as loading and page weight. Results are a snapshot of the observed run." },
      { title: "Automated accessibility", text: "Lighthouse findings and scores for automatically detectable criteria. Human review is still needed to assess real journeys and compliance." },
    ],
    resultTitle: "How to read the results",
    resultText: "The report groups performance, security, SEO and accessibility scores, then lists detected issues and actions to examine first. Measurement coverage and module status distinguish a completed check from an unavailable one.",
    resultNote: "A score is a diagnostic indicator, not a certification or a guarantee of traffic, security or compliance.",
    limitsTitle: "What this audit does not cover",
    limits: [
      "Submitting one URL does not crawl every page or authenticated area of a site.",
      "Automated tools do not replace human SEO, security or accessibility review.",
      "A module may fail or be skipped when the page blocks bots, a service is unavailable or a measurement does not apply. The report may then be partial.",
      "Performance and some signals vary with time, network, browser and site changes.",
    ],
    privacyTitle: "A report accessible through its link",
    privacyText: "No account is required. Anyone with the unique link can access the report, so keep it private if the findings are sensitive. Report pages are excluded from indexing and are not published as examples.",
    moreTitle: "Explore further",
    moreText: "Read the FAQ for practical questions and our digital accessibility guide to understand what requires a human audit.",
    homeLink: "Explore Argos",
    faqLink: "Read the FAQ",
    scoreMethodLink: "How the score is calculated (French)",
    accessibilityLink: "Understand digital accessibility",
    checklistLink: "Follow the website audit checklist",
  },
} as const;

export default function AuditTechniquePage() {
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
            <div className={s.formPanel} id="audit">
              <h2>{c.formTitle}</h2>
              <AuditForm mode="public" sourceRoute="/ressources/audit-technique-gratuit" />
              <p className={s.formHint}>{c.formHint}</p>
            </div>
          </div>
        </header>

        <section className={s.section} aria-labelledby="method-title">
          <div className={s.container}>
            <h2 id="method-title">{c.methodTitle}</h2>
            <p className={s.intro}>{c.methodLead}</p>
            <ol className={s.steps}>
              {c.steps.map((step) => (
                <li key={step.number} className={s.step}>
                  <span className={s.stepNumber} aria-hidden="true">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${s.section} ${s.alternate}`} aria-labelledby="measures-title">
          <div className={s.container}>
            <h2 id="measures-title">{c.measuresTitle}</h2>
            <p className={s.intro}>{c.measuresLead}</p>
            <div className={s.measureGrid}>
              {c.measures.map((measure) => (
                <div className={s.measure} key={measure.title}>
                  <h3>{measure.title}</h3>
                  <p>{measure.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={s.section} aria-labelledby="result-title">
          <div className={s.narrow}>
            <h2 id="result-title">{c.resultTitle}</h2>
            <p>{c.resultText}</p>
            <p className={s.note}>{c.resultNote}</p>
          </div>
        </section>

        <section className={`${s.section} ${s.alternate}`} aria-labelledby="limits-title">
          <div className={s.narrow}>
            <h2 id="limits-title">{c.limitsTitle}</h2>
            <ul className={s.limits}>{c.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
          </div>
        </section>

        <ChoosingArgos />

        <section className={s.section} aria-labelledby="privacy-title">
          <div className={s.narrow}>
            <h2 id="privacy-title">{c.privacyTitle}</h2>
            <p>{c.privacyText}</p>
          </div>
        </section>

        <section className={`${s.section} ${s.more}`} aria-labelledby="more-title">
          <div className={s.container}>
            <h2 id="more-title">{c.moreTitle}</h2>
            <p>{c.moreText}</p>
            <div className={s.links}>
              <Link href="/">{c.homeLink}</Link>
              <Link href="/faq">{c.faqLink}</Link>
              <Link href="/ressources/accessibilite-numerique">{c.accessibilityLink}</Link>
              <Link href="/guides/checklist-audit-site-web">{c.checklistLink}</Link>
              <Link href="/methodologie-score">{c.scoreMethodLink}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
