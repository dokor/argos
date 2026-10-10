"use client";

import Link from "next/link";
import EditorialMeta from "@/components/marketing/EditorialMeta";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./page.module.scss";

const sources = [
  {
    href: "https://accessibilite.numerique.gouv.fr/",
    fr: "DINUM — Référentiel général d’amélioration de l’accessibilité (RGAA 4.1.2)",
    en: "DINUM — General framework for improving accessibility (RGAA 4.1.2)",
  },
  {
    href: "https://accessibilite.numerique.gouv.fr/obligations/champ-application/",
    fr: "DINUM — Champ d’application de l’article 47",
    en: "DINUM — Scope of Article 47",
  },
  {
    href: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048050174",
    fr: "Légifrance — Article 47-1 et sanctions",
    en: "Légifrance — Article 47-1 and penalties",
  },
  {
    href: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019L0882",
    fr: "EUR-Lex — Directive (UE) 2019/882",
    en: "EUR-Lex — Directive (EU) 2019/882",
  },
  {
    href: "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite",
    fr: "DGCCRF — Obligations et contrôles de la directive Accessibilité",
    en: "DGCCRF — European Accessibility Act obligations and enforcement",
  },
  {
    href: "https://www.w3.org/WAI/standards-guidelines/wcag/",
    fr: "W3C WAI — Présentation des WCAG",
    en: "W3C WAI — WCAG overview",
  },
] as const;

const copy = {
  fr: {
    eyebrow: "Guide · Accessibilité numérique",
    title: "RGAA et EAA : comprendre les obligations d’accessibilité numérique",
    lead: "Un site accessible permet à chacun de lire, naviguer et utiliser un service, y compris avec un clavier, un lecteur d’écran ou un affichage agrandi. En France, le RGAA et l’European Accessibility Act (EAA) définissent des obligations distinctes selon l’organisme et le service.",
    byline: "Par",
    updated: "Mis à jour le 6 octobre 2026",
    jump: "Dans cet article",
    toc: [
      ["difference", "RGAA ou EAA ?"],
      ["principes", "Les grands principes"],
      ["rgaa", "Qui est concerné par le RGAA ?"],
      ["eaa", "Qui est concerné par l’EAA ?"],
      ["obligations", "Quelles obligations concrètes ?"],
      ["sanctions", "Quelles sanctions ?"],
      ["agir", "Par où commencer ?"],
      ["questions", "Questions fréquentes"],
    ],
    facts: [
      { value: "4", label: "principes WCAG : perceptible, utilisable, compréhensible et robuste" },
      { value: "4.1.2", label: "version du RGAA publiée à la date de cet article" },
      { value: "28 juin 2025", label: "application de l’EAA aux services visés fournis aux consommateurs" },
    ],
    differenceTitle: "RGAA ou EAA : quelle différence ?",
    differenceText: "Le RGAA sert à contrôler l’accessibilité des services en ligne soumis à l’article 47 en France. L’EAA encadre certains produits et services destinés aux consommateurs dans l’Union européenne, dont le commerce électronique. Un organisme peut relever des deux cadres : il faut examiner son statut et le service proposé.",
    sourceLabel: "Sources :",
    rgaaReference: "Champ d’application du RGAA",
    eaaReference: "Directive (UE) 2019/882",
    article47Reference: "Article 47-1",
    dgccrfReference: "Fiche DGCCRF",
    principlesTitle: "Les quatre principes d’un site accessible",
    principlesIntro: "Les règles internationales WCAG organisent l’accessibilité autour de quatre principes. Le RGAA fournit, en France, une méthode de contrôle détaillée ; son édition 4.1.2 compte 106 critères.",
    principles: [
      { title: "Perceptible", text: "Prévoir des alternatives textuelles aux images, des sous-titres, un contraste lisible et des contenus adaptables." },
      { title: "Utilisable", text: "Permettre l’accès au clavier, donner assez de temps et rendre la navigation et le focus visibles." },
      { title: "Compréhensible", text: "Écrire clairement, garder un comportement prévisible et expliquer les erreurs de formulaire." },
      { title: "Robuste", text: "Employer une structure et des composants compatibles avec les navigateurs et technologies d’assistance." },
    ],
    rgaaTitle: "Qui est concerné par le RGAA en France ?",
    rgaaIntro: "Le Référentiel général d’amélioration de l’accessibilité (RGAA) est la méthode de contrôle associée aux obligations de l’article 47 de la loi du 11 février 2005. Les services de communication au public en ligne des organismes suivants sont notamment concernés :",
    rgaaItems: [
      "les personnes morales de droit public : État, collectivités et établissements publics ;",
      "certaines personnes privées chargées d’une mission de service public ou répondant à des besoins d’intérêt général dans les conditions prévues par la loi ;",
      "les entreprises atteignant le seuil légal de 250 M€ de chiffre d’affaires, calculé sur la moyenne du chiffre d’affaires annuel réalisé en France pendant les trois derniers exercices clos.",
    ],
    rgaaNote: "Le statut de l’organisme et le périmètre exact du service doivent être vérifiés. Un nom de domaine ou la taille apparente d’un site ne suffisent pas à déterminer l’application de l’article 47.",
    eaaTitle: "Qui est concerné par l’European Accessibility Act ?",
    eaaIntro: "La directive (UE) 2019/882, dite EAA, s’applique depuis le 28 juin 2025 à certains produits mis sur le marché et à certains services fournis aux consommateurs. Pour le web, les catégories de services comprennent notamment :",
    eaaItems: [
      "le commerce électronique B2C ;",
      "les services bancaires aux consommateurs ;",
      "les livres numériques et logiciels dédiés ;",
      "les communications électroniques et l’accès aux médias audiovisuels ;",
      "certains éléments numériques des transports de voyageurs, dont les sites, applications et billets électroniques.",
    ],
    eaaNote: "Les microentreprises qui fournissent des services sont exemptées si elles emploient moins de dix personnes et si leur chiffre d’affaires annuel ou le total de leur bilan annuel n’excède pas 2 M€. Les autres dérogations, comme la charge disproportionnée, nécessitent une évaluation documentée. Une exemption EAA ne dispense pas automatiquement des autres obligations.",
    overlap: "Un même organisme peut relever des deux cadres. Le RGAA et l’EAA ne couvrent pas exactement les mêmes acteurs ni les mêmes obligations.",
    obligationsTitle: "Quelles obligations concrètes ?",
    obligations: [
      { title: "Tester les parcours réels", text: "Vérifier les pages et fonctionnalités clés au clavier, avec les technologies d’assistance et selon les critères applicables. Les outils automatiques ne détectent qu’une partie des problèmes." },
      { title: "Corriger et maintenir", text: "Traiter les obstacles dans les formulaires, la navigation, les contenus, les médias et les composants interactifs, puis intégrer ces vérifications aux évolutions du service." },
      { title: "Publier les informations requises", text: "Pour les organismes soumis à l’article 47 : déclaration d’accessibilité fondée sur une évaluation, mention en page d’accueil, schéma pluriannuel et plan d’action selon les règles applicables." },
      { title: "Informer sur le service EAA", text: "Pour les prestataires de services concernés : rendre accessibles les informations sur le service et sur la façon dont il satisfait aux exigences d’accessibilité." },
    ],
    sanctionsTitle: "Quelles sanctions en cas de non-respect ?",
    sanctionsIntro: "Les montants dépendent du cadre, de l’opérateur, du manquement et de la procédure. Ils ne se déduisent ni d’un score Lighthouse ni du nombre d’erreurs détectées automatiquement.",
    sanctions: [
      { title: "Article 47 / RGAA", text: "Après mise en demeure, l’Arcom peut prononcer jusqu’à 50 000 € pour le non-respect de l’obligation d’accessibilité des organismes visés aux 1° à 3° de l’article 47. Le plafond est de 25 000 € pour les obligations de publication visées aux III et IV, selon le périmètre de l’article 47-1." },
      { title: "EAA / code de la consommation", text: "La DGCCRF peut enjoindre la mise en conformité, parfois avec astreinte et publicité. Les infractions aux obligations d’accessibilité prévues par le code de la consommation peuvent relever de contraventions de 5e classe ; la DGCCRF indique des amendes de 7 500 € pour les personnes morales, cumulables selon les infractions constatées." },
    ],
    sanctionsNote: "Une anomalie repérée par Argos ne vaut pas infraction constatée. Les montants ci-dessus sont des plafonds, appliqués selon la procédure propre à chaque régime.",
    actionTitle: "Par où commencer ?",
    actionIntro: "Commencez par identifier l’organisme, le service proposé, les utilisateurs visés et les textes applicables. Réalisez ensuite un audit de conformité sur un échantillon représentatif, corrigez les parcours bloquants et retestez avec des personnes concernées.",
    actionSteps: [
      "Qualifier le périmètre : organisme public, mission de service public, grande entreprise ou service B2C visé par l’EAA.",
      "Repérer les obstacles techniques et les parcours prioritaires.",
      "Faire confirmer les résultats par un audit humain, puis publier les documents requis lorsque le cadre s’applique.",
    ],
    ctaTitle: "Repérez les premiers signaux sur votre site",
    ctaText: "Argos analyse gratuitement une URL et remonte des constats techniques d’accessibilité, de performance, de SEO et de sécurité dans un rapport privé.",
    ctaButton: "Tester mon site avec Argos",
    ctaLimit: "Ce diagnostic automatisé ne constitue ni un audit RGAA/WCAG complet ni une certification de conformité ou un avis juridique.",
    questionsTitle: "Questions fréquentes",
    questions: [
      { q: "Un simple site vitrine est-il automatiquement soumis à l’EAA ?", a: "Non. L’EAA cible des catégories de produits et de services précises, notamment des services de commerce électronique destinés aux consommateurs. Il faut examiner le service réellement fourni. L’article 47 peut s’appliquer indépendamment, selon l’organisme." },
      { q: "Un bon score Lighthouse prouve-t-il la conformité RGAA ?", a: "Non. Lighthouse repère certains défauts automatisables. Un audit RGAA demande aussi des tests manuels, notamment sur le clavier, le focus, la compréhension et les parcours complets." },
      { q: "Un site créé avant 2025 bénéficie-t-il d’un délai général jusqu’en 2030 ?", a: "Non. La DGCCRF précise qu’un site ou une application n’est pas un « produit » bénéficiant automatiquement de la transition applicable à certains produits utilisés pour fournir un service. Les transitions dépendent du cas précis." },
    ],
    sourcesTitle: "Sources officielles",
    sourcesIntro: "Textes et guides consultés le 6 octobre 2026. Vérifiez leur version et leur application à votre activité avant toute décision de conformité.",
  },
  en: {
    eyebrow: "Guide · Digital accessibility",
    title: "RGAA and EAA: understanding digital accessibility obligations",
    lead: "An accessible website lets everyone read, navigate and use a service, including with a keyboard, screen reader or enlarged display. In France, the RGAA and the European Accessibility Act (EAA) create distinct obligations depending on the organisation and service.",
    byline: "By",
    updated: "Updated 6 October 2026",
    jump: "In this article",
    toc: [
      ["difference", "RGAA or EAA?"],
      ["principes", "The four principles"],
      ["rgaa", "Who is covered by the RGAA?"],
      ["eaa", "Who is covered by the EAA?"],
      ["obligations", "Practical obligations"],
      ["sanctions", "Penalties"],
      ["agir", "Where to start"],
      ["questions", "Frequently asked questions"],
    ],
    facts: [
      { value: "4", label: "WCAG principles: perceivable, operable, understandable and robust" },
      { value: "4.1.2", label: "current published RGAA version at the date of this article" },
      { value: "28 June 2025", label: "EAA application to covered consumer services" },
    ],
    differenceTitle: "RGAA or EAA: what is the difference?",
    differenceText: "The RGAA is the French method for checking the accessibility of online services covered by Article 47. The EAA sets requirements for certain consumer products and services across the European Union, including e-commerce. An organisation may fall under both frameworks, so its status and the service it provides need to be assessed.",
    sourceLabel: "Sources:",
    rgaaReference: "RGAA scope",
    eaaReference: "Directive (EU) 2019/882",
    article47Reference: "Article 47-1",
    dgccrfReference: "DGCCRF guidance",
    principlesTitle: "The four principles of an accessible site",
    principlesIntro: "The international WCAG guidelines organise accessibility around four principles. In France, the RGAA provides a detailed testing method; version 4.1.2 has 106 criteria.",
    principles: [
      { title: "Perceivable", text: "Provide text alternatives for images, captions, readable contrast and adaptable content." },
      { title: "Operable", text: "Support keyboard use, allow enough time and make navigation and focus visible." },
      { title: "Understandable", text: "Use clear language, keep behaviour predictable and explain form errors." },
      { title: "Robust", text: "Use structures and components compatible with browsers and assistive technologies." },
    ],
    rgaaTitle: "Who is covered by the RGAA in France?",
    rgaaIntro: "The RGAA (Référentiel général d’amélioration de l’accessibilité) is the testing framework associated with Article 47 of the French law of 11 February 2005. The following organisations' online public communication services are among those covered:",
    rgaaItems: [
      "public law bodies, including the State, local authorities and public establishments;",
      "certain private bodies providing a public service or meeting a general interest need under the conditions set by law;",
      "companies reaching the statutory €250 million threshold, based on average annual revenue generated in France over the previous three closed financial years.",
    ],
    rgaaNote: "The organisation's status and the exact scope of its service must be checked. A domain name or a site's apparent size cannot establish whether Article 47 applies.",
    eaaTitle: "Who is covered by the European Accessibility Act?",
    eaaIntro: "Directive (EU) 2019/882, known as the EAA, has applied since 28 June 2025 to certain products placed on the market and certain consumer services. Web related service categories include:",
    eaaItems: [
      "B2C e-commerce;",
      "consumer banking;",
      "e-books and dedicated software;",
      "electronic communications and access to audiovisual media;",
      "certain digital parts of passenger transport, including websites, apps and electronic tickets.",
    ],
    eaaNote: "Microenterprises providing services are exempt if they employ fewer than ten people and their annual turnover or annual balance sheet total does not exceed €2 million. Other exceptions, such as a disproportionate burden, require a documented assessment. An EAA exemption does not automatically remove obligations under other laws.",
    overlap: "The same organisation may fall under both frameworks. The RGAA and EAA do not cover precisely the same actors or obligations.",
    obligationsTitle: "What are the practical obligations?",
    obligations: [
      { title: "Test real journeys", text: "Check key pages and features with a keyboard and assistive technology against the applicable criteria. Automated tools find only some barriers." },
      { title: "Fix and maintain", text: "Address barriers in forms, navigation, content, media and interactive components, then include accessibility checks in future changes." },
      { title: "Publish required information", text: "For bodies subject to Article 47: an accessibility statement based on an assessment, a homepage notice, a multi year plan and an action plan as required." },
      { title: "Explain EAA service accessibility", text: "Covered service providers must make information about the service and how it meets accessibility requirements accessible." },
    ],
    sanctionsTitle: "What are the penalties for non-compliance?",
    sanctionsIntro: "Amounts depend on the legal framework, operator, breach and procedure. A Lighthouse score or number of automated findings cannot determine a fine.",
    sanctions: [
      { title: "Article 47 / RGAA", text: "After formal notice, Arcom may impose up to €50,000 for breaching the accessibility obligation on bodies covered by points 1 to 3 of Article 47. The cap is €25,000 for publication obligations under paragraphs III and IV, within the scope set by Article 47-1." },
      { title: "EAA / French Consumer Code", text: "The DGCCRF can order compliance, sometimes with a daily penalty and publication. Breaches of accessibility duties under the Consumer Code can be class 5 offences; the DGCCRF cites €7,500 fines for legal entities, which may accumulate according to the offences found." },
    ],
    sanctionsNote: "An issue found by Argos is not a legally established offence. The amounts above are ceilings, applied under the procedure specific to each framework.",
    actionTitle: "Where should you start?",
    actionIntro: "First identify the organisation, the service, its intended users and applicable legislation. Then conduct a conformance audit on a representative sample, fix blocking journeys and retest with affected users.",
    actionSteps: [
      "Determine scope: public body, public service mission, large company or a B2C service covered by the EAA.",
      "Identify technical barriers and priority user journeys.",
      "Confirm findings through a human audit, then publish required documents where applicable.",
    ],
    ctaTitle: "Spot the first signals on your site",
    ctaText: "Argos scans a URL for free and reports technical accessibility, performance, SEO and security findings in a private report.",
    ctaButton: "Test my site with Argos",
    ctaLimit: "This automated diagnosis is neither a complete RGAA/WCAG audit nor a certification of compliance or legal advice.",
    questionsTitle: "Frequently asked questions",
    questions: [
      { q: "Is every brochure website automatically covered by the EAA?", a: "No. The EAA targets specific products and services, including consumer e-commerce. The service actually provided must be assessed. Article 47 may apply independently based on the organisation." },
      { q: "Does a high Lighthouse score prove RGAA compliance?", a: "No. Lighthouse detects some issues automatically. An RGAA audit also requires manual checks, notably for keyboard use, focus, understanding and complete journeys." },
      { q: "Does a website built before 2025 have a general grace period until 2030?", a: "No. The DGCCRF explains that a website or app is not a 'product' automatically eligible for the transition for certain products used to provide a service. Transitional rules depend on the specific case." },
    ],
    sourcesTitle: "Official sources",
    sourcesIntro: "Laws and guides consulted on 6 October 2026. Check their current version and application to your activity before making a compliance decision.",
  },
} as const;

export default function AccessibilityArticlePage() {
  const { lang } = useLang();
  const c = copy[lang];

  return (
    <div className={s.page}>
      <SiteNav />
      <main>
        <header className={s.hero}>
          <div className={s.heroInner}>
            <p className={s.eyebrow}>{c.eyebrow}</p>
            <h1>{c.title}</h1>
            <EditorialMeta route="/ressources/accessibilite-numerique" />
            <p className={s.lead}>{c.lead}</p>
            <div className={s.heroActions}>
              <Link href="/#audit" className={s.primaryCta}>{c.ctaButton} <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </header>

        <div className={s.content}>
          <aside className={s.toc} aria-label={c.jump}>
            <p className={s.tocTitle}>{c.jump}</p>
            <ol>{c.toc.map(([id, label]) => <li key={id}><a href={'#' + id}>{label}</a></li>)}</ol>
          </aside>

          <article className={s.article}>
            <div className={s.facts}>
              {c.facts.map((fact) => (
                <div key={fact.value} className={s.fact}>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </div>
              ))}
            </div>

            <section id="difference" className={s.section}>
              <h2>{c.differenceTitle}</h2>
              <p>{c.differenceText}</p>
              <p className={s.sourceRef}>{c.sourceLabel} <a href="https://accessibilite.numerique.gouv.fr/obligations/champ-application/">{c.rgaaReference}</a> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019L0882">{c.eaaReference}</a></p>
            </section>

            <section id="principes" className={s.section}>
              <h2>{c.principlesTitle}</h2>
              <p>{c.principlesIntro}</p>
              <div className={s.principles}>
                {c.principles.map((item, index) => (
                  <div key={item.title} className={s.principle}>
                    <span className={s.principleNumber} aria-hidden="true">0{index + 1}</span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="rgaa" className={s.section}>
              <h2>{c.rgaaTitle}</h2>
              <p>{c.rgaaIntro}</p>
              <ul>{c.rgaaItems.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className={s.note}>{c.rgaaNote}</p>
              <p className={s.sourceRef}>{c.sourceLabel} <a href="https://accessibilite.numerique.gouv.fr/obligations/champ-application/">{c.rgaaReference}</a></p>
            </section>

            <section id="eaa" className={s.section}>
              <h2>{c.eaaTitle}</h2>
              <p>{c.eaaIntro}</p>
              <ul>{c.eaaItems.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className={s.note}>{c.eaaNote}</p>
              <p className={s.overlap}>{c.overlap}</p>
              <p className={s.sourceRef}>{c.sourceLabel} <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019L0882">{c.eaaReference}</a></p>
            </section>

            <section id="obligations" className={s.section}>
              <h2>{c.obligationsTitle}</h2>
              <div className={s.obligations}>
                {c.obligations.map((item) => (
                  <div key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="sanctions" className={s.section}>
              <h2>{c.sanctionsTitle}</h2>
              <p>{c.sanctionsIntro}</p>
              <div className={s.sanctions}>
                {c.sanctions.map((item) => (
                  <div key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
              <p className={s.note}>{c.sanctionsNote}</p>
              <p className={s.sourceRef}>{c.sourceLabel} <a href="https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048050174">{c.article47Reference}</a> · <a href="https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite">{c.dgccrfReference}</a></p>
            </section>

            <section id="agir" className={s.section}>
              <h2>{c.actionTitle}</h2>
              <p>{c.actionIntro}</p>
              <ol className={s.actionSteps}>{c.actionSteps.map((item) => <li key={item}>{item}</li>)}</ol>
            </section>

            <section className={s.ctaBlock} aria-labelledby="article-cta">
              <h2 id="article-cta">{c.ctaTitle}</h2>
              <p>{c.ctaText}</p>
              <Link href="/#audit" className={s.primaryCta}>{c.ctaButton} <span aria-hidden="true">→</span></Link>
              <small>{c.ctaLimit}</small>
            </section>

            <section id="questions" className={s.section}>
              <h2>{c.questionsTitle}</h2>
              <div className={s.questions}>
                {c.questions.map((item) => (
                  <div key={item.q}>
                    <h3>{item.q}</h3>
                    <p>{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={s.sources} id="references">
              <h2>{c.sourcesTitle}</h2>
              <p>{c.sourcesIntro}</p>
              <ul>
                {sources.map((source) => (
                  <li key={source.href}>
                    <a href={source.href}>{source[lang]} <span aria-hidden="true">↗</span></a>
                  </li>
                ))}
              </ul>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
