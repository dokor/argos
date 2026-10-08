"use client";

import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ChoosingArgos.module.scss";

const copy = {
  fr: {
    title: "Quand choisir Argos ?",
    scopeTitle: "Que vérifie Argos sur une page, et quelles sont ses limites ?",
    scope: "Argos rapproche la réponse HTTP, les en-têtes, les balises HTML, les mesures du navigateur et les résultats des services disponibles. Le rapport classe les constats par performance, sécurité, SEO et accessibilité. Il porte sur une URL publique : il ne parcourt pas tout le site, ne teste pas les espaces connectés et ne certifie ni la sécurité ni l’accessibilité. Vérifiez la couverture et les modules indisponibles avant de conclure.",
    compareTitle: "Que complète Argos par rapport à PageSpeed Insights ou Lighthouse ?",
    tool: "Outil", use: "À choisir pour", limit: "À garder en tête",
    rows: [
      ["Argos", "Obtenir un premier diagnostic transversal et une liste d’actions à discuter avec votre prestataire : HTML, HTTP, TLS, navigateur et Lighthouse selon disponibilité.", "Le score Argos suit sa propre pondération. Il ne se compare pas directement au score Lighthouse et ne représente pas les visites réelles."],
      ["PageSpeed Insights", "Examiner la performance mobile et ordinateur, avec les diagnostics Lighthouse et les données d’usage CrUX quand elles sont disponibles.", "Les données réelles peuvent manquer ou concerner l’origine plutôt que la page. Complétez par une revue des parcours et de la configuration serveur."],
      ["Lighthouse", "Approfondir les diagnostics de performance, accessibilité, bonnes pratiques et SEO, puis répéter une mesure dans des conditions maîtrisées.", "Une mesure de laboratoire varie et les contrôles automatiques ne suffisent pas à valider les usages réels."],
    ],
    sources: "Références :",
    prioritizeTitle: "Comment transformer le rapport en ordre de correction ?",
    priorities: [
      "Vérifiez d’abord que le constat s’applique : page analysée, preuve, module exécuté, contexte et comportement voulu.",
      "Traitez les blocages de parcours et les risques confirmés, puis les corrections à fort impact et faible effort. Confiez chaque action à un responsable avec un critère de validation.",
      "Relancez l’analyse de la même URL dans des conditions comparables, puis contrôlez le parcours manuellement. Un meilleur score ne suffit pas à prouver une hausse des ventes ou des contacts.",
    ],
    pme: "Pour une PME : commencez par la page de service qui mène à une demande de devis. Vérifiez le formulaire au clavier et l’envoi réel, puis corrigez les balises SEO et le chargement. Argos donne des signaux techniques ; il ne vérifie pas la réception du devis ni la qualité du message commercial.",
    ecommerce: "Pour une boutique : commencez par une fiche produit représentative. Vérifiez humainement le choix des variantes, l’ajout au panier et le paiement ; corrigez les blocages avant d’optimiser les images et les balises. Auditez séparément les pages publiques clés : Argos ne simule pas une commande et ne teste pas les espaces clients.",
    example: "Voir les preuves et les corrections dans l’exemple de rapport public",
  },
  en: {
    title: "When should you choose Argos?",
    scopeTitle: "What does Argos check on a page, and what are its limits?",
    scope: "Argos brings together the HTTP response, headers, HTML tags, browser measurements and available analysis services. Findings are grouped into performance, security, SEO and accessibility. It examines one public URL: it does not crawl the whole site, test signed-in areas or certify security or accessibility. Check coverage and unavailable modules before drawing conclusions.",
    compareTitle: "What does Argos add to PageSpeed Insights or Lighthouse?",
    tool: "Tool", use: "Choose it to", limit: "Keep in mind",
    rows: [
      ["Argos", "Get an initial cross-disciplinary diagnosis and actions to discuss with your provider: HTML, HTTP, TLS, browser and Lighthouse signals when available.", "Argos uses its own score weights. Its score cannot be compared directly with Lighthouse and does not represent real visits."],
      ["PageSpeed Insights", "Examine mobile and desktop performance using Lighthouse diagnostics and CrUX usage data when available.", "Field data may be missing or apply to the origin instead of the page. Also review user journeys and server configuration."],
      ["Lighthouse", "Investigate performance, accessibility, best practices and SEO diagnostics, then repeat measurements under controlled conditions.", "Lab measurements vary and automated checks cannot validate real user journeys alone."],
    ],
    sources: "References:",
    prioritizeTitle: "How do you turn a report into a correction order?",
    priorities: [
      "First confirm that each finding applies: the analyzed page, evidence, completed module, context and intended behavior.",
      "Address blocked journeys and confirmed risks, then high-impact fixes that require little effort. Assign an owner and a validation criterion to each action.",
      "Analyze the same URL again under comparable conditions, then check the journey manually. A better score alone does not prove more sales or leads.",
    ],
    pme: "For a small business: start with the service page leading to a quote request. Check keyboard access and actual form submission, then address SEO tags and loading. Argos provides technical signals; it does not confirm delivery of a quote request or assess sales copy.",
    ecommerce: "For a store: start with a representative product page. Manually check variant selection, adding to the cart and payment; fix blockers before optimizing images and tags. Audit key public pages separately: Argos does not simulate an order or test customer accounts.",
    example: "See evidence and corrections in the public example report",
  },
} as const;

export default function ChoosingArgos({ audience }: { audience?: "pme" | "ecommerce" }) {
  const { lang } = useLang();
  const c = copy[lang];
  return (
    <section className={s.section} aria-labelledby="choosing-argos-title" id="choisir-argos">
      <h2 id="choosing-argos-title">{c.title}</h2>
      <h3>{c.scopeTitle}</h3>
      <p>{c.scope}</p>
      <h3>{c.compareTitle}</h3>
      <div className={s.tableWrap} role="region" aria-label={c.compareTitle} tabIndex={0}>
        <table>
          <thead><tr><th scope="col">{c.tool}</th><th scope="col">{c.use}</th><th scope="col">{c.limit}</th></tr></thead>
          <tbody>{c.rows.map(([tool, use, limit]) => <tr key={tool}><th scope="row">{tool}</th><td>{use}</td><td>{limit}</td></tr>)}</tbody>
        </table>
      </div>
      <p className={s.sources}>{c.sources} <a href="https://developers.google.com/speed/docs/insights/v5/about">PageSpeed Insights</a> · <a href="https://developer.chrome.com/docs/lighthouse/overview">Lighthouse</a></p>
      <h3>{c.prioritizeTitle}</h3>
      <ol>{c.priorities.map((item) => <li key={item}>{item}</li>)}</ol>
      {(!audience || audience === "pme") && <p>{c.pme}</p>}
      {(!audience || audience === "ecommerce") && <p>{c.ecommerce}</p>}
      <Link href="/exemple-rapport">{c.example}</Link>
    </section>
  );
}
