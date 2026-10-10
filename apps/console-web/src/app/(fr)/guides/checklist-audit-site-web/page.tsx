"use client";

import Link from "next/link";
import { useState } from "react";
import AuditForm from "@/components/AuditForm";
import EditorialMeta from "@/components/marketing/EditorialMeta";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ChoosingArgos from "@/components/marketing/ChoosingArgos";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./page.module.scss";

// The French copy is rendered during prerendering and is the canonical content.
// The language toggle changes the article after hydration, as on other resources.
const copy = {
  fr: {
    eyebrow: "Guide pratique · 6 étapes",
    title: "Checklist d’audit de site web : les vérifications à faire soi-même",
    lead: "Choisissez une page importante, ouvrez-la comme un visiteur et notez ce que vous observez. Cette checklist d’audit technique vous aide à trouver des problèmes concrets avant de lancer un outil automatique.",
    scope: "Travaillez sur une URL précise, puis recommencez sur une page de chaque type important (accueil, service, article, produit). Un résultat sur une seule page ne décrit pas tout le site.",
    contents: "Aller à une étape",
    labels: { why: "Pourquoi", check: "Comment vérifier", expected: "Résultat attendu", fix: "Si le contrôle échoue", argos: "Ce qu’Argos mesure — et sa limite" },
    steps: [
      {
        id: "acces-page", title: "La page est-elle accessible ?",
        why: "Une page indisponible ou remplacée par un écran de blocage ne peut pas remplir son rôle pour les visiteurs.",
        check: "Ouvrez l’URL dans une fenêtre privée, sur ordinateur puis sur mobile. Notez l’URL finale, le contenu affiché et le code de réponse dans l’onglet Réseau du navigateur.",
        expected: "La page voulue s’affiche, sans boucle de redirection ni erreur serveur. Une redirection voulue aboutit à la bonne URL.",
        fix: "Corrigez l’adresse, les redirections, le serveur ou une règle de protection qui bloque les visiteurs légitimes, puis refaites le test.",
        argos: "Argos relève la réponse HTTP et certains blocages détectables sur l’URL soumise. Il ne visite pas les espaces connectés et ne garantit pas l’accès depuis tous les réseaux.",
      },
      {
        id: "indexabilite", title: "La page peut-elle être indexée ?",
        why: "Une page utile pour la recherche peut être exclue par erreur ou désigner une autre URL comme version principale.",
        check: "Pour une page destinée à Google, vérifiez robots.txt, la directive meta robots ou X-Robots-Tag, le lien canonical et le sitemap. Confirmez l’URL retenue avec l’inspection d’URL de Search Console si vous avez accès à la propriété.",
        expected: "La page que vous souhaitez rendre visible peut être explorée et n’a pas de directive noindex involontaire. La canonique désigne la version souhaitée ; le sitemap recense les URL importantes.",
        fix: "Retirez le blocage involontaire et harmonisez redirections, canonique et sitemap. Gardez les exclusions intentionnelles sur les pages privées ou sans intérêt pour la recherche.",
        argos: "Argos détecte des signaux de robots.txt, sitemap, meta robots et la présence d’une canonique. Il ne connaît pas votre stratégie éditoriale et ne prouve pas que Google a indexé la page ou choisi cette canonique.",
      },
      {
        id: "html-seo", title: "Le HTML décrit-il clairement la page ?",
        why: "Le titre, les titres visibles et les liens aident les lecteurs et les moteurs à comprendre le sujet.",
        check: "Lisez la balise title, la meta description, le H1, l’ordre des sous-titres et les liens internes dans le HTML livré. Vérifiez aussi les textes alternatifs des images utiles.",
        expected: "Le title et le H1 décrivent le contenu réel ; les titres suivent une structure compréhensible ; les liens mènent aux pages pertinentes et les images informatives ont un texte alternatif utile.",
        fix: "Réécrivez les libellés génériques, corrigez la structure et les liens cassés, puis ajoutez des alternatives adaptées aux images informatives.",
        argos: "Argos contrôle des balises, des titres et la présence d’attributs alt. Il ne juge ni la qualité du texte, ni l’intention de recherche, ni la pertinence d’une alternative.",
      },
      {
        id: "https-entetes", title: "HTTPS et les en-têtes sont-ils cohérents ?",
        why: "Une connexion fiable et des en-têtes adaptés réduisent certains risques techniques, sans suffire à établir la sécurité du site.",
        check: "Dans le navigateur, inspectez le certificat et l’URL HTTPS finale. Dans l’onglet Réseau, examinez les en-têtes de réponse, notamment HSTS et Content-Security-Policy, et recherchez les ressources chargées en HTTP.",
        expected: "Le certificat est valide pour le domaine, les pages sensibles utilisent HTTPS, les ressources ne créent pas de contenu mixte et les protections annoncées correspondent au fonctionnement du site.",
        fix: "Renouvelez ou corrigez le certificat, redirigez les URL HTTP, chargez les ressources en HTTPS et ajustez les en-têtes après test pour éviter de bloquer des fonctions utiles.",
        argos: "Argos relève TLS et plusieurs en-têtes ; des services externes peuvent compléter ces constats. Une absence d’alerte ne constitue ni un test d’intrusion ni une garantie de sécurité.",
      },
      {
        id: "performance", title: "La page reste-t-elle rapide et utilisable ?",
        why: "Un chargement lent ou une interface qui réagit tard nuit aux tâches des visiteurs.",
        check: "Chargez la page sur mobile et sur une connexion plus lente, puis refaites la mesure avec Lighthouse. Repérez images lourdes, scripts bloquants et décalages visuels. Comparez avec les données de terrain si vous en disposez.",
        expected: "Le contenu principal apparaît sans attente excessive, l’interface réagit aux interactions et la mise en page reste stable dans les conditions testées.",
        fix: "Optimisez les images et polices, reportez les scripts non essentiels et réservez l’espace des éléments qui arrivent tard ; mesurez de nouveau après chaque changement.",
        argos: "Argos collecte des métriques de navigateur et des scores Lighthouse sur une exécution. Cette mesure de laboratoire varie et ne remplace pas les données d’usage réel, notamment pour l’interactivité.",
      },
      {
        id: "accessibilite", title: "Les parcours sont-ils accessibles ?",
        why: "Une page peut sembler correcte à la souris tout en bloquant des personnes qui utilisent le clavier ou une technologie d’assistance.",
        check: "Parcourez la page au clavier : ordre, focus visible, menus et formulaire. Vérifiez les noms des champs et boutons, les textes alternatifs, les contrastes, puis essayez un lecteur d’écran sur un parcours clé.",
        expected: "Chaque action essentielle reste compréhensible et réalisable sans souris, avec des indications perceptibles et des messages d’erreur identifiables.",
        fix: "Corrigez d’abord les blocages de parcours, les commandes sans nom et le focus invisible ; refaites un essai humain après les corrections.",
        argos: "Argos remonte des signaux automatiques et un score Lighthouse. Il ne valide pas à lui seul la conformité RGAA/WCAG ni l’expérience vécue par les utilisateurs.",
      },
    ],
    exampleTitle: "Exemple : par quoi commencer ?",
    exampleIntro: "Sur une fiche produit, vous relevez une directive noindex involontaire, une image lourde et un bouton d’achat inaccessible au clavier.",
    exampleOrder: [
      "Corrigez le bouton bloquant : une tâche essentielle est impossible pour certains visiteurs.",
      "Retirez le noindex si cette fiche doit apparaître dans les résultats, puis vérifiez l’indexation dans Search Console.",
      "Optimisez l’image, mesurez à nouveau sur mobile et surveillez les données de terrain.",
    ],
    exampleEnd: "L’ordre réel dépend de l’impact sur vos utilisateurs, de votre objectif et du coût de correction. Un score global ne remplace pas ce jugement.",
    nextTitle: "Approfondir un point",
    links: [
      { href: "/ressources/audit-technique-gratuit#result-title", label: "Comprendre les résultats et les limites du score Argos" },
      { href: "/ressources/accessibilite-numerique", label: "Approfondir l’accessibilité numérique" },
      { href: "/ressources/audit-site-ecommerce", label: "Appliquer la méthode à un site e-commerce" },
      { href: "/faq", label: "Voir ce que contient un rapport privé" },
    ],
    sourcesTitle: "Références pour vérifier vos constats",
    sources: [
      { href: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls", label: "Google Search Central : URL canonique" },
      { href: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag", label: "Google Search Central : directives robots" },
      { href: "https://web.dev/articles/vitals-tools", label: "web.dev : mesures de laboratoire et de terrain" },
      { href: "https://www.w3.org/WAI/WCAG22/quickref/", label: "W3C : référentiel WCAG 2.2" },
    ],
    ctaTitle: "Accélérer les contrôles automatisables",
    ctaText: "Une fois la vérification manuelle terminée, lancez un audit gratuit d’une page publique. Le rapport privé rassemble les signaux mesurables ; conservez vos notes pour les points qui demandent un examen humain.",
  },
  en: {
    eyebrow: "Practical guide · 6 steps",
    title: "Website audit checklist: checks you can do yourself",
    lead: "Choose an important page, open it like a visitor, and record what you see. This technical audit checklist helps you find concrete issues before running an automated tool.",
    scope: "Work on one URL, then repeat on a page of each important type (home, service, article, product). One page cannot describe an entire website.",
    contents: "Jump to a step",
    labels: { why: "Why it matters", check: "How to check", expected: "Expected result", fix: "If it fails", argos: "What Argos checks — and its limit" },
    steps: [
      { id: "acces-page", title: "Can visitors access the page?", why: "An unavailable page or a blocking screen cannot serve visitors.", check: "Open the URL in a private window on desktop and mobile. Record the final URL, visible content, and response status in the browser Network panel.", expected: "The intended page appears without a redirect loop or server error. Any intentional redirect leads to the correct URL.", fix: "Fix the address, redirects, server, or a protection rule blocking legitimate visitors, then test again.", argos: "Argos records the HTTP response and some detectable blocks for the submitted URL. It cannot inspect signed-in areas or guarantee access from every network." },
      { id: "indexabilite", title: "Can the page be indexed?", why: "A useful search page may be excluded by mistake or point to another URL as its preferred version.", check: "For a page intended for Google, check robots.txt, meta robots or X-Robots-Tag, the canonical link, and the sitemap. If you own the property, confirm the selected URL with Search Console URL Inspection.", expected: "The intended page can be crawled and has no accidental noindex rule. Its canonical points to the preferred version; important URLs appear in the sitemap.", fix: "Remove unintended blocks and align redirects, canonical, and sitemap. Keep intentional exclusions for private or low-value pages.", argos: "Argos detects robots.txt, sitemap, meta robots, and the presence of a canonical. It cannot know your editorial intent or prove that Google indexed the page or chose that canonical." },
      { id: "html-seo", title: "Does the HTML describe the page?", why: "The title, visible headings, and links help readers and search engines understand its subject.", check: "Read the title tag, meta description, H1, heading order, and internal links in the delivered HTML. Check text alternatives for informative images.", expected: "The title and H1 describe the real content; headings are understandable; links lead to relevant pages; informative images have useful alternatives.", fix: "Rewrite generic labels, repair structure and broken links, and add suitable alternatives to informative images.", argos: "Argos checks tags, headings, and the presence of alt attributes. It cannot judge writing quality, search intent, or the usefulness of an alternative." },
      { id: "https-entetes", title: "Are HTTPS and headers sound?", why: "A reliable connection and appropriate headers reduce some technical risks, without proving that a site is secure.", check: "Inspect the certificate and final HTTPS URL in the browser. In the Network panel, examine response headers such as HSTS and Content-Security-Policy, and look for resources loaded over HTTP.", expected: "The certificate is valid for the domain, sensitive pages use HTTPS, resources cause no mixed content, and declared protections fit the site.", fix: "Renew or correct the certificate, redirect HTTP URLs, load resources over HTTPS, and test header changes so useful functions still work.", argos: "Argos checks TLS and several headers; external services may add findings. No warning is not a penetration test or a security guarantee." },
      { id: "performance", title: "Is the page fast and usable?", why: "Slow loading or delayed interaction makes visitors' tasks harder.", check: "Load the page on mobile and a slower connection, then repeat with Lighthouse. Look for heavy images, blocking scripts, and layout shifts. Compare with field data when available.", expected: "Main content appears without excessive delay, interactions respond, and the layout stays stable in the conditions tested.", fix: "Optimize images and fonts, defer nonessential scripts, reserve space for late elements, and measure again after each change.", argos: "Argos collects browser metrics and Lighthouse scores for one run. This lab snapshot varies and does not replace real-user data, especially for interactivity." },
      { id: "accessibilite", title: "Are key journeys accessible?", why: "A page can appear fine with a mouse while blocking people using a keyboard or assistive technology.", check: "Use only a keyboard to test order, visible focus, menus, and forms. Check field and button names, text alternatives, and contrast, then try a screen reader on a key journey.", expected: "Every essential action is understandable and possible without a mouse, with perceptible guidance and identifiable errors.", fix: "Fix blocked journeys, unnamed controls, and invisible focus first; repeat a human check after the changes.", argos: "Argos reports automated signals and a Lighthouse score. It cannot certify WCAG compliance or a real user's experience on its own." },
    ],
    exampleTitle: "Example: what should you fix first?",
    exampleIntro: "On a product page, you find an accidental noindex rule, a heavy image, and a purchase button that cannot be reached by keyboard.",
    exampleOrder: [
      "Fix the blocked button: some visitors cannot complete an essential task.",
      "Remove noindex if the product should appear in search, then verify indexing in Search Console.",
      "Optimize the image, measure again on mobile, and monitor field data.",
    ],
    exampleEnd: "The actual order depends on user impact, your goals, and the cost of each fix. An overall score cannot replace that judgment.",
    nextTitle: "Explore further",
    links: [
      { href: "/ressources/audit-technique-gratuit#result-title", label: "Understand Argos results and score limits" },
      { href: "/ressources/accessibilite-numerique", label: "Learn more about digital accessibility" },
      { href: "/ressources/audit-site-ecommerce", label: "Apply the method to an e-commerce site" },
      { href: "/faq", label: "See what a private report contains" },
    ],
    sourcesTitle: "References to check your findings",
    sources: [
      { href: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls", label: "Google Search Central: canonical URLs" },
      { href: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag", label: "Google Search Central: robots directives" },
      { href: "https://web.dev/articles/vitals-tools", label: "web.dev: lab and field measurements" },
      { href: "https://www.w3.org/WAI/WCAG22/quickref/", label: "W3C: WCAG 2.2 quick reference" },
    ],
    ctaTitle: "Speed up the checks a tool can run",
    ctaText: "After your manual review, run a free audit of a public page. The private report gathers measurable signals; keep your notes for checks that require a person.",
  },
} as const;

export default function ChecklistAuditPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setChecked(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const controls = lang === "fr" ? {
    note: "Les cases servent à suivre votre lecture : elles ne valident aucun contrôle technique. La progression est remise à zéro au rechargement.",
    done: "étapes marquées", print: "Imprimer la checklist", reset: "Réinitialiser", audit: "Lancer un audit pour les contrôles automatisables",
  } : {
    note: "Tick boxes track your review; they do not validate any technical check. Progress resets when you reload the page.",
    done: "steps marked", print: "Print the checklist", reset: "Reset", audit: "Run an audit for automated checks",
  };

  return (
    <div className={s.page}>
      <SiteNav />
      <main>
        <header className={s.hero}>
          <div className={s.container}>
            <p className={s.eyebrow}>{c.eyebrow}</p>
            <h1>{c.title}</h1>
            <EditorialMeta route="/guides/checklist-audit-site-web" />
            <p className={s.lead}>{c.lead}</p>
            <p className={s.scope}>{c.scope}</p>
            <p className={s.earlyCta}><a href="#audit-gratuit">{controls.audit}</a></p>
          </div>
        </header>

        <div className={s.container}>
          <div className={s.controls}>
            <p>{controls.note}</p>
            <p role="status" aria-live="polite">{checked.size} / {c.steps.length} {controls.done}</p>
            <div className={s.buttons}>
              <button type="button" onClick={() => window.print()}>{controls.print}</button>
              <button type="button" onClick={() => setChecked(new Set())}>{controls.reset}</button>
            </div>
          </div>
          <nav className={s.contents} aria-label={c.contents}>
            <h2>{c.contents}</h2>
            <ol>{c.steps.map((step) => <li key={step.id}><a href={`#${step.id}`}>{step.title}</a></li>)}</ol>
          </nav>

          <section className={s.checklist} aria-label={c.title}>
            <ol>
              {c.steps.map((step, index) => (
                <li className={s.step} id={step.id} key={step.id}>
                  <div className={s.stepHeading}>
                    <span className={s.stepNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <input className={s.checkbox} id={`check-${step.id}`} type="checkbox" checked={checked.has(step.id)} onChange={() => toggle(step.id)} />
                    <h2><label htmlFor={`check-${step.id}`}>{step.title}</label></h2>
                  </div>
                  <dl className={s.fields}>
                    <div><dt>{c.labels.why}</dt><dd>{step.why}</dd></div>
                    <div><dt>{c.labels.check}</dt><dd>{step.check}</dd></div>
                    <div><dt>{c.labels.expected}</dt><dd>{step.expected}</dd></div>
                    <div><dt>{c.labels.fix}</dt><dd>{step.fix}</dd></div>
                    <div><dt>{c.labels.argos}</dt><dd>{step.argos}</dd></div>
                  </dl>
                </li>
              ))}
            </ol>
          </section>

          <section className={s.example} aria-labelledby="example-title" id="exemple-priorisation">
            <h2 id="example-title">{c.exampleTitle}</h2>
            <p>{c.exampleIntro}</p>
            <ol>{c.exampleOrder.map((item) => <li key={item}>{item}</li>)}</ol>
            <p>{c.exampleEnd}</p>
          </section>

          <section className={s.more} aria-labelledby="more-title">
            <h2 id="more-title">{c.nextTitle}</h2>
            <ul>{c.links.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
            <h3 id="references">{c.sourcesTitle}</h3>
            <ul>{c.sources.map((source) => <li key={source.href}><a href={source.href}>{source.label}</a></li>)}</ul>
          </section>

          <section className={s.cta} aria-labelledby="cta-title" id="audit-gratuit">
            <h2 id="cta-title">{c.ctaTitle}</h2>
            <p>{c.ctaText}</p>
            <AuditForm mode="public" sourceRoute="/guides/checklist-audit-site-web" />
          </section>
        </div>
        <ChoosingArgos context="checklist" />
      </main>
      <SiteFooter />
    </div>
  );
}
