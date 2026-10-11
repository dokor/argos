"use client";
import DemoReport from "./DemoReport";

import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ChoosingArgos from "./ChoosingArgos";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ExampleReport.module.scss";

const copy = {
  fr: {
    eyebrow: "Démonstration contrôlée · Exemple public",
    title: "Un constat, une preuve, une correction",
    lead: "Voici comment lire des constats Argos sur une fiche produit de démonstration : comprendre la preuve, choisir une action, puis vérifier la correction.",
    disclosure: "Exemple pédagogique préparé à partir des fichiers HTML ci-dessous, et non rapport issu d’une exécution complète d’Argos. Aucun score ni gain de performance n’est présenté comme mesuré. Aucun site client ni rapport utilisateur n’est utilisé.",
    fixtureTitle: "Le site de démonstration : Atelier Démo",
    fixtureText: "Une boutique fictive avec une seule fiche produit, sans compte, commande ni collecte de données. Nous contrôlons les deux versions et leurs ressources. Les défauts sont introduits dans la version avant ; les liens permettent d’examiner les pages et leur code source dans votre navigateur.",
    beforeLink: "Ouvrir la page avant correction", afterLink: "Ouvrir la page après correction",
    findingsTitle: "Trois constats expliqués",
    before: "Avant · preuve HTML", after: "Après · correction HTML", verify: "Comment vérifier", check: "Contrôle Argos associé",
    findings: [
      { title: "SEO : titre trop court", key: "html.title", before: "<title>Sac</title>", after: "<title>Sac en coton réutilisable | Atelier Démo</title>", impact: "Le titre « Sac » contient seulement 3 caractères. Le contrôle HTML signale un titre très court ; il ne juge pas la pertinence éditoriale. Un titre descriptif aide à identifier la page dans un onglet ou un résultat de recherche.", verify: "Comparez les balises title dans les deux sources, puis relancez le contrôle HTML. Vérifiez humainement que le titre décrit le produit. Cela ne prouve pas un meilleur classement Google." },
      { title: "SEO : description absente", key: "html.meta.description.present", before: "<!-- Aucune meta description -->", after: '<meta name="description" content="Découvrez le sac en coton réutilisable Atelier Démo, ses dimensions et ses conseils d’entretien.">', impact: "La version avant ne contient aucune meta description. Le contrôle peut constater cette absence. La correction donne un résumé cohérent, mais un moteur de recherche peut choisir un autre extrait.", verify: "Cherchez meta name=\"description\" dans la source après correction. Argos vérifie ce signal technique ; relisez le texte pour sa clarté et sa cohérence avec le contenu." },
      { title: "Accessibilité : image sans alternative", key: "html.images.alt_coverage", before: '<img src="/demo/atelier/sac.svg" width="320" height="240">', after: '<img src="/demo/atelier/sac.svg" width="320" height="240" alt="Sac en coton écru avec deux anses">', impact: "La seule image de la version avant n’a pas d’attribut alt : 1 image sur 1 sans alternative. Le contrôle HTML détecte l’attribut manquant. Pour cette image informative, nous ajoutons une description ; une image décorative demanderait alt=\"\".", verify: "Comparez les attributs des images : 0 attribut alt manquant sur 1 image après correction. Vérifiez ensuite l’utilité du texte avec une revue humaine et un lecteur d’écran ; la présence d’un attribut ne suffit pas à prouver l’accessibilité." },
    ],
    planTitle: "Comment prioriser ces corrections ?",
    plan: [
      "Confirmer les trois preuves sur la fiche produit et les contrôles effectivement exécutés. Ici, aucun parcours d’achat réel n’existe et aucun risque de sécurité n’a été évalué.",
      "Ajouter l’alternative de l’image informative, puis rédiger le titre et la description. Ces corrections sont simples et peuvent être livrées ensemble ; leur ordre dépend de vos visiteurs et objectifs.",
      "Valider les changements dans le HTML livré, relancer un audit de la même page, puis vérifier humainement le contenu et l’accès au clavier. Sur une vraie boutique, un blocage d’achat passerait avant ces améliorations.",
    ],
    coverageTitle: "Ce que cet exemple ne démontre pas",
    coverage: "Les preuves portent uniquement sur trois contrôles HTML. Les en-têtes HTTP, TLS, services de sécurité, mesures du navigateur et scores Lighthouse ne sont pas mesurés ici. Ces trois preuves seules ne permettent pas de calculer un score global mesuré. Les deux pages restent noindex pour éviter d’indexer la boutique fictive ; cet état est intentionnel et inchangé après correction.",
    privacy: "Vos rapports restent accessibles par leur lien privé et exclus de l’indexation. Cette page publique est une ressource éditoriale distincte, sans accès aux rapports utilisateurs.",
    next: "Appliquer la méthode à votre site", pme: "Prioriser pour un site PME", ecommerce: "Prioriser pour un e-commerce", audit: "Lancer l’audit d’une page publique",
  },
  en: {
    eyebrow: "Controlled demo · Public example",
    title: "A finding, evidence, a correction",
    lead: "Learn how to read Argos findings on a demo product page: understand the evidence, choose an action, then verify the correction.",
    disclosure: "An educational example prepared from the HTML files below, not a report from a complete Argos run. No score or performance gain is presented as measured. No customer site or user report is used.",
    fixtureTitle: "The demo site: Atelier Démo",
    fixtureText: "A fictional store with one product page, no accounts, orders or data collection. We control both versions and their assets. The before version has deliberately introduced issues; the links let you inspect the pages and their source in your browser. Demo pages are in French.",
    beforeLink: "Open the page before corrections", afterLink: "Open the page after corrections",
    findingsTitle: "Three findings explained",
    before: "Before · HTML evidence", after: "After · HTML correction", verify: "How to verify", check: "Related Argos check",
    findings: [
      { title: "SEO: very short title", key: "html.title", before: "<title>Sac</title>", after: "<title>Sac en coton réutilisable | Atelier Démo</title>", impact: "The title ‘Sac’ is only 3 characters long. The HTML check flags a very short title; it does not evaluate editorial relevance. A descriptive title helps identify a page in a browser tab or search result.", verify: "Compare the title tags in both sources, then rerun the HTML check. Manually confirm that the title describes the product. This does not prove better Google rankings." },
      { title: "SEO: missing description", key: "html.meta.description.present", before: "<!-- No meta description -->", after: '<meta name="description" content="Découvrez le sac en coton réutilisable Atelier Démo, ses dimensions et ses conseils d’entretien.">', impact: "The before version has no meta description. The check can identify that absence. The correction provides a coherent summary, but a search engine may choose a different snippet.", verify: 'Find meta name="description" in the corrected source. Argos checks this technical signal; review the text for clarity and consistency with the content.' },
      { title: "Accessibility: image without alternative text", key: "html.images.alt_coverage", before: '<img src="/demo/atelier/sac.svg" width="320" height="240">', after: '<img src="/demo/atelier/sac.svg" width="320" height="240" alt="Sac en coton écru avec deux anses">', impact: 'The only image in the before version has no alt attribute: 1 out of 1 images lack an alternative. The HTML check detects the missing attribute. We add a description for this informative image; a decorative image would need alt="".', verify: "Compare image attributes: 0 out of 1 images have a missing alt attribute after correction. Then assess the text with a human review and a screen reader; an attribute alone does not prove accessibility." },
    ],
    planTitle: "How should you prioritize these corrections?",
    plan: [
      "Confirm all three pieces of evidence on the product page and the checks actually completed. Here, no real purchase journey exists and no security risk has been assessed.",
      "Add alternative text for the informative image, then write the title and description. These simple changes can ship together; their order depends on your visitors and goals.",
      "Validate the delivered HTML, rerun an audit of the same page, then manually review content and keyboard access. On a real store, a blocked purchase would come before these improvements.",
    ],
    coverageTitle: "What this example does not demonstrate",
    coverage: "Evidence covers only three HTML checks. HTTP headers, TLS, security services, browser measurements and Lighthouse scores are not measured here. These three pieces of evidence alone cannot produce a measured overall score. Both demo pages remain noindex to keep the fictional store out of search; this is intentional and unchanged after correction.",
    privacy: "Your reports remain accessible through their private link and excluded from indexing. This public page is a separate editorial resource with no access to user reports.",
    next: "Apply the method to your site", pme: "Prioritize for a small business", ecommerce: "Prioritize for an e-commerce site", audit: "Audit a public page",
  },
} as const;

export default function ExampleReport() {
  const { lang } = useLang();
  const c = copy[lang];
  return (
    <div className={s.page}>
      <SiteNav />
      <main id="top">
        <header className={s.hero}><div className={s.container}>
          <p className={s.eyebrow}>{c.eyebrow}</p><h1>{c.title}</h1><p className={s.lead}>{c.lead}</p>
          <p className={s.notice}>{c.disclosure}</p>
        </div></header>
        <div className={s.container}>
          <DemoReport />
          <section className={s.section} aria-labelledby="fixture-title">
            <h2 id="fixture-title">{c.fixtureTitle}</h2><p>{c.fixtureText}</p>
            <div className={s.links}><a href="/demo/atelier/avant.html">{c.beforeLink}</a><a href="/demo/atelier/apres.html">{c.afterLink}</a></div>
          </section>
          <section className={s.section} aria-labelledby="findings-title">
            <h2 id="findings-title">{c.findingsTitle}</h2>
            {c.findings.map((finding) => <article className={s.finding} key={finding.key}>
              <h3>{finding.title}</h3><p>{c.check} : <code>{finding.key}</code></p><p>{finding.impact}</p>
              <div className={s.comparison}>
                <div><h4>{c.before}</h4><pre><code>{finding.before}</code></pre></div>
                <div><h4>{c.after}</h4><pre><code>{finding.after}</code></pre></div>
              </div>
              <h4>{c.verify}</h4><p>{finding.verify}</p>
            </article>)}
          </section>
          <section className={s.section} aria-labelledby="plan-title"><h2 id="plan-title">{c.planTitle}</h2><ol>{c.plan.map((step) => <li key={step}>{step}</li>)}</ol></section>
          <section className={s.notice} aria-labelledby="coverage-title"><h2 id="coverage-title">{c.coverageTitle}</h2><p>{c.coverage}</p><p>{c.privacy}</p></section>
        </div>
        <ChoosingArgos context="example" />
        <nav className={`${s.container} ${s.section}`} aria-label={c.next}><h2>{c.next}</h2><div className={s.links}>
          <Link href="/ressources/audit-site-pme">{c.pme}</Link><Link href="/ressources/audit-site-ecommerce">{c.ecommerce}</Link><Link href="/#audit">{c.audit}</Link>
        </div></nav>
      </main>
      <SiteFooter />
    </div>
  );
}
