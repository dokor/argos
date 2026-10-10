"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ContactLinks from "@/components/site/ContactLinks";
import s from "./PublicInfo.module.scss";
export default function AboutPage() { const { lang } = useLang(); const fr = lang === "fr"; return <div className={s.page}><SiteNav /><main>
  <h1>{fr ? "À propos d’Argos" : "About Argos"}</h1>
  <p>{fr ? "Argos est créé et exploité par Antoine Le Louët. Il rassemble les signaux techniques d’une page publique pour aider à décider quoi vérifier et corriger en premier." : "Argos is created and operated by Antoine Le Louët. It gathers technical signals from a public page to help you decide what to check and fix first."}</p>
  <section><h2>{fr ? "Pour préparer des corrections concrètes" : "To prepare concrete fixes"}</h2><p>{fr ? "Indépendants, PME, équipes e-commerce et agences peuvent utiliser ce premier diagnostic pour préparer un échange avec la personne qui intervient sur leur site. Une URL est analysée à la fois ; le rapport ne remplace pas les parcours humains ni un audit complet." : "Freelancers, small businesses, e-commerce teams and agencies can use this initial diagnosis to prepare a discussion with whoever works on their website. One URL is analysed at a time; the report does not replace human journey reviews or a complete audit."}</p></section>
  <section><h2>{fr ? "Une méthode consultable" : "A method you can inspect"}</h2><p>{fr ? "Les contrôles alimentent quatre domaines : performance, sécurité, SEO et accessibilité. Lisez les constats avec la couverture des mesures ; une mesure indisponible ne signifie pas une réussite." : "Checks feed four domains: performance, security, SEO and accessibility. Read findings alongside measurement coverage; an unavailable measurement does not mean a pass."}</p><p><Link href="/methodologie-score#resume">{fr ? "Comprendre la méthode" : "Read the method (French)"}</Link> · <Link href="/exemple-rapport">{fr ? "Voir un exemple fictif commenté" : "See a commented fictional example"}</Link></p></section>
  <section><h2>{fr ? "Source disponible sous BSL 1.1" : "Source available under BSL 1.1"}</h2><p>{fr ? "Le code est consultable dans le dépôt public. La Business Source License 1.1 impose des conditions, notamment pour certains usages commerciaux de service hébergé. Consultez la licence pour les droits et restrictions applicables." : "Code is available in the public repository. Business Source License 1.1 imposes conditions, including for certain commercial hosted-service uses. Read the licence for applicable rights and restrictions."}</p><a href="https://github.com/dokor/argos/blob/main/LICENSE">{fr ? "Consulter la licence" : "Read the licence"}</a></section>
  <section><h2>{fr ? "Échanger avec l’opérateur" : "Contact the operator"}</h2><ContactLinks /></section>
</main><SiteFooter /></div>; }
