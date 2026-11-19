"use client";
import { localizeValue } from "@/lib/i18n/messages";
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
  const { lang, t } = useLang(), copy = t.marketing.ecommerce;
  const report = demoReport(lang), alternative = report.issues[1], description = report.issues[0];
  return <div className={s.page}><SiteNav /><main>
    <header className={s.hero}><div className={s.container}><p className={s.eyebrow}>{copy.eyebrow}</p><h1 className={s.title}>{copy.title}</h1><p className={s.lead}>{copy.lead}</p><a href="#audit" className={s.heroCta}>{(lang === "fr" ? "Analyser une page de ma boutique" : localizeValue("Analyse a page from my store", lang))}</a><p className={s.heroNote}>{copy.heroNote}</p></div></header>
    <section className={s.section}><div className={s.container}><h2 className={s.sectionTitle}>{(lang === "fr" ? "Une fiche produit, deux corrections documentées" : localizeValue("One product page, two documented corrections", lang))}</h2>
      <div className={s.productDemo}><figure className={s.product}><p className={s.eyebrow}>{(lang === "fr" ? "Atelier Démo · boutique fictive" : localizeValue("Atelier Démo · fictional store", lang))}</p><Image unoptimized src="/demo/atelier/sac.svg" width="320" height="240" alt={(lang === "fr" ? "Sac en coton écru avec deux anses" : localizeValue("Natural cotton bag with two handles", lang))} /><figcaption>{(lang === "fr" ? "Sac en coton réutilisable. Illustration accessible : la preuve du défaut concerne la version HTML avant correction." : localizeValue("Reusable cotton bag. Accessible illustration: evidence of the issue comes from the HTML version before correction.", lang))}</figcaption></figure>
        <ol className={s.annotations}><li><h3>{(lang === "fr" ? "1. Décrire l’image informative" : localizeValue("1. Describe the informative image", lang))}</h3><pre><code>{alternative.evidence}</code></pre><p>{alternative.recommendation}</p><p>{(lang === "fr" ? "Vérification : attribut alt présent et texte pertinent pour un lecteur d’écran ; contrôler humainement son sens." : localizeValue("Verify the alt attribute and useful wording for screen reader users; review its meaning manually.", lang))}</p></li>
          <li><h3>{(lang === "fr" ? "2. Résumer cette fiche" : localizeValue("2. Summarise this product page", lang))}</h3><pre><code>{description.evidence}</code></pre><p>{description.recommendation}</p><p>{(lang === "fr" ? "Vérification : balise description dans le HTML initial, cohérente avec le produit. Aucune hausse de ventes déduite de cette correction." : localizeValue("Verify a description tag in the initial HTML that matches the product. No sales increase is inferred from this correction.", lang))}</p></li></ol>
      </div><p className={s.heroNote}>{(lang === "fr" ? "Données illustratives issues de la démonstration commune ; aucun audit client ni parcours de commande mesuré." : localizeValue("Illustrative data from the shared demo; no customer audit or measured ordering journey.", lang))}</p><Link href="/exemple-rapport">{(lang === "fr" ? "Comparer le HTML avant et après correction" : localizeValue("Compare HTML before and after correction", lang))}</Link></div></section>
    <section id="audit" className={`${s.section} ${s.ctaSection}`} aria-labelledby="audit-title"><div className={s.container}><h2 id="audit-title" className={s.sectionTitle}>{(lang === "fr" ? "Analyser une page de ma boutique" : localizeValue("Analyse a page from my store", lang))}</h2><p className={s.paragraph}>{(lang === "fr" ? "Une URL publique : fiche produit ou catégorie. Aucune connexion, commande ni étape de paiement n’est testée." : localizeValue("One public URL: a product or category page. No login, order or payment step is tested.", lang))}</p><AuditForm mode="public" sourceRoute="/ressources/audit-site-ecommerce" /></div></section>
    <section className={s.section}><div className={s.container}><h2 className={s.sectionTitle}>{t.marketing.common.measuresTitle}</h2><div className={s.measureGrid}>{copy.measures.map(item => <article className={s.card} key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></div></section>
    <section className={s.section} aria-labelledby="ecommerce-guide-title"><div className={s.container}>
      <h2 id="ecommerce-guide-title" className={s.sectionTitle}>{(lang === "fr" ? "Auditer le parcours de votre boutique" : localizeValue("Audit your store’s shopping journey", lang))}</h2>
      <p className={s.paragraph}>{(lang === "fr" ? "Complétez l’analyse d’une page avec sept étapes : catalogue, fiches produit, vitesse mobile, panier et paiement. Conservez les preuves pour prioriser vos corrections." : localizeValue("Complement a page analysis with seven steps covering your catalogue, product pages, mobile speed, cart and checkout. Keep evidence to prioritise fixes.", lang))}</p>
      <Link href="/guides/checklist-audit-ecommerce">{(lang === "fr" ? "Lire la checklist d’audit e-commerce" : localizeValue("Read the ecommerce audit checklist", lang))}</Link>
    </div></section>
    <ChoosingArgos audience="ecommerce" />
  </main><SiteFooter /></div>;
}
