"use client";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import AuditForm from "@/components/AuditForm";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ChoosingArgos from "./ChoosingArgos";
import { useLang } from "@/lib/i18n/LangContext";
import { demoReport } from "./reportDemoFixture";
import s from "./AudiencePage.module.scss";
export default function EcommercePage() {
  const { lang, t } = useLang(), fr = lang === "fr", copy = t.marketing.ecommerce;
  const report = demoReport(lang), alternative = report.issues[1], description = report.issues[0];
  return <div className={s.page}><SiteNav /><main>
    <header className={s.hero}><div className={s.container}><p className={s.eyebrow}>{copy.eyebrow}</p><h1 className={s.title}>{copy.title}</h1><p className={s.lead}>{copy.lead}</p><a href="#audit" className={s.heroCta}>{fr ? "Analyser une page de ma boutique" : "Analyse a page from my store"}</a><p className={s.heroNote}>{copy.heroNote}</p></div></header>
    <section className={s.section}><div className={s.container}><h2 className={s.sectionTitle}>{fr ? "Une fiche produit, deux corrections documentées" : "One product page, two documented corrections"}</h2>
      <div className={s.productDemo}><figure className={s.product}><p className={s.eyebrow}>{fr ? "Atelier Démo · boutique fictive" : "Atelier Démo · fictional store"}</p><Image unoptimized src="/demo/atelier/sac.svg" width="320" height="240" alt={fr ? "Sac en coton écru avec deux anses" : "Natural cotton bag with two handles"} /><figcaption>{fr ? "Sac en coton réutilisable. Illustration accessible : la preuve du défaut concerne la version HTML avant correction." : "Reusable cotton bag. Accessible illustration: evidence of the issue comes from the HTML version before correction."}</figcaption></figure>
        <ol className={s.annotations}><li><h3>{fr ? "1. Décrire l’image informative" : "1. Describe the informative image"}</h3><pre><code>{alternative.evidence}</code></pre><p>{alternative.recommendation}</p><p>{fr ? "Vérification : attribut alt présent et texte pertinent pour un lecteur d’écran ; contrôler humainement son sens." : "Verify the alt attribute and useful wording for screen reader users; review its meaning manually."}</p></li>
          <li><h3>{fr ? "2. Résumer cette fiche" : "2. Summarise this product page"}</h3><pre><code>{description.evidence}</code></pre><p>{description.recommendation}</p><p>{fr ? "Vérification : balise description dans le HTML initial, cohérente avec le produit. Aucune hausse de ventes déduite de cette correction." : "Verify a description tag in the initial HTML that matches the product. No sales increase is inferred from this correction."}</p></li></ol>
      </div><p className={s.heroNote}>{fr ? "Données illustratives issues de la démonstration commune ; aucun audit client ni parcours de commande mesuré." : "Illustrative data from the shared demo; no customer audit or measured ordering journey."}</p><Link href="/exemple-rapport">{fr ? "Comparer le HTML avant et après correction" : "Compare HTML before and after correction"}</Link></div></section>
    <section id="audit" className={`${s.section} ${s.ctaSection}`} aria-labelledby="audit-title"><div className={s.container}><h2 id="audit-title" className={s.sectionTitle}>{fr ? "Analyser une page de ma boutique" : "Analyse a page from my store"}</h2><p className={s.paragraph}>{fr ? "Une URL publique : fiche produit ou catégorie. Aucune connexion, commande ni étape de paiement n’est testée." : "One public URL: a product or category page. No login, order or payment step is tested."}</p><AuditForm mode="public" sourceRoute="/ressources/audit-site-ecommerce" /></div></section>
    <section className={s.section}><div className={s.container}><h2 className={s.sectionTitle}>{t.marketing.common.measuresTitle}</h2><div className={s.measureGrid}>{copy.measures.map(item => <article className={s.card} key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></div></section>
    <ChoosingArgos audience="ecommerce" />
  </main><SiteFooter /></div>;
}
