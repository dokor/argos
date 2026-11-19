"use client";
import { localizeValue } from "@/lib/i18n/messages";
import Link from "@/components/LocalizedLink";
import AuditForm from "@/components/AuditForm";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ChoosingArgos from "./ChoosingArgos";
import { useLang } from "@/lib/i18n/LangContext";
import { demoReport } from "./reportDemoFixture";
import s from "./AudiencePage.module.scss";
export default function SmallBusinessPage() {
  const { lang, t } = useLang(), copy = t.marketing.pme;
  const issue = demoReport(lang).issues[0];
  return <div className={s.page}><SiteNav /><main>
    <header className={s.hero}><div className={s.container}><p className={s.eyebrow}>{copy.eyebrow}</p><h1 className={s.title}>{copy.title}</h1><p className={s.lead}>{copy.lead}</p>
      <a href="#audit" className={s.heroCta}>{(lang === "fr" ? "Analyser une page gratuitement" : localizeValue("Analyse a page for free", lang))}</a></div></header>
    <section className={s.section}><div className={s.container}><h2 className={s.sectionTitle}>{(lang === "fr" ? "Un brief concret pour votre agence" : localizeValue("A concrete brief for your agency", lang))}</h2>
      <div className={s.example}><p className={s.eyebrow}>{(lang === "fr" ? "Exemple fictif · page de service" : localizeValue("Fictional example · service page", lang))}</p>
        <h3>{issue.title}</h3><p>{(lang === "fr" ? "Une page de conseil ne fournit pas de résumé dans son HTML. Ce constat ne juge pas la qualité commerciale du texte." : localizeValue("A consulting page provides no summary in its HTML. This finding does not evaluate sales copy.", lang))}</p>
        <pre><code>{issue.evidence}</code></pre>
        <dl className={s.brief}><div><dt>{(lang === "fr" ? "Correction à transmettre" : localizeValue("Correction to request", lang))}</dt><dd>{(lang === "fr" ? "Ajouter une meta description qui résume le service, son public et la zone desservie, sans promesse absente de la page." : localizeValue("Add a meta description summarising the service, audience and service area, without claims missing from the page.", lang))}</dd></div>
          <div><dt>{(lang === "fr" ? "Critère de réception" : localizeValue("Acceptance check", lang))}</dt><dd>{(lang === "fr" ? "La balise est présente dans le HTML initial. Son texte décrit le service ; relancer la même URL et vérifier le contenu manuellement. Google peut choisir un autre extrait." : localizeValue("The tag exists in the initial HTML. Its text describes the service; rerun the same URL and review the content manually. Google may choose another snippet.", lang))}</dd></div></dl>
        <Link href="/exemple-rapport">{(lang === "fr" ? "Voir les preuves et corrections de l’exemple complet" : localizeValue("Read the full example with evidence and corrections", lang))}</Link>
      </div></div></section>
    <section id="audit" className={`${s.section} ${s.ctaSection}`} aria-labelledby="audit-title"><div className={s.container}><h2 id="audit-title" className={s.sectionTitle}>{(lang === "fr" ? "Analyser une page gratuitement" : localizeValue("Analyse a page for free", lang))}</h2><p className={s.paragraph}>{(lang === "fr" ? "Une seule URL publique est analysée. Les demandes de devis et les espaces connectés ne sont pas testés." : localizeValue("One public URL is analysed. Quote submissions and signed-in areas are not tested.", lang))}</p><AuditForm mode="public" sourceRoute="/ressources/audit-site-pme" /></div></section>
    <section className={s.section}><div className={s.container}><h2 className={s.sectionTitle}>{t.marketing.common.measuresTitle}</h2><div className={s.measureGrid}>{copy.measures.map(item => <article className={s.card} key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></div></section>
    <ChoosingArgos audience="pme" />
    <nav className={`${s.related} ${s.container}`} aria-label={t.marketing.common.otherPages}><Link href="/guides/checklist-audit-site-web">{(lang === "fr" ? "Préparer votre checklist" : localizeValue("Prepare your checklist", lang))}</Link> · <Link href="/methodologie-score#resume">{(lang === "fr" ? "Comprendre les scores" : localizeValue("Understand the scores", lang))}</Link></nav>
  </main><SiteFooter /></div>;
}
