import { localizeValue, localizedCopy } from "@/lib/i18n/messages";
import Link from "@/components/PageLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import EditorialMeta from "./EditorialMeta";
import { technicalGuides } from "@/lib/technicalGuides";
import { localizedPath, type Lang } from "@/lib/i18n/routes";
import s from "./TechnicalGuidePage.module.scss";

export default function TechnicalGuidePage({ guide, lang }: { guide: keyof typeof technicalGuides; lang: Lang }) {
  const data = technicalGuides[guide]; const c = localizedCopy(data, lang); return <div className={s.page} lang={lang}>
    <SiteNav /><main>
      <header className={s.hero}><div className={s.container}>
        <p className={s.eyebrow}>{(lang === "fr" ? "Guide de correction" : localizeValue("Correction guide", lang))}</p>
        <h1>{c.title}</h1><EditorialMeta route={data.route} /><p className={s.lead}>{c.lead}</p>
      </div></header>
      <div className={s.container}>
        <nav className={s.contents} aria-label={(lang === "fr" ? "Sommaire du guide" : localizeValue("Guide contents", lang))}>
          <ol>{c.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
        </nav>
        {c.sections.map(section => <section className={s.section} id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
          <h2 id={`${section.id}-title`}>{section.title}</h2>
          {section.paragraphs.map(p => <p key={p}>{p}</p>)}
          {guide === "lcp" && section.id === "diagnostic" && <p><Link href={localizedPath("/ressources/audit-wordpress", lang)}>{(lang === "fr" ? "Sur WordPress, retrouver le bloc, le thème ou le cache à vérifier" : localizeValue("On WordPress, find the block, theme or cache to check", lang))}</Link></p>}
          {section.code && <pre tabIndex={0} aria-label={(lang === "fr" ? "Exemple à adapter" : localizeValue("Example to adapt", lang))}><code>{section.code}</code></pre>}
          {section.steps && <ol>{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}
        </section>)}
        {guide === "lcp" && <section className={s.section} aria-labelledby="demo-title">
          <h2 id="demo-title">{(lang === "fr" ? "Avant/après mesuré sur une démonstration locale" : localizeValue("Measured before/after on a local demonstration", lang))}</h2>
          <p>{(lang === "fr" ? "Le 16 octobre 2026, navigateur Chromium intégré, fenêtre 390 × 844, sans ralentissement CPU/réseau, réponses no-store sur loopback. Même image et priorité : avant, insertion par JavaScript après un délai artificiel de 1 000 ms ; après, image présente dans le HTML initial. Élément LCP vérifié : #hero." : localizeValue("16 October 2026, integrated Chromium browser, 390 × 844 viewport, no CPU/network throttling, no-store responses over loopback. Same image and priority: before, JavaScript inserts it after an artificial 1,000 ms delay; after, it is in the initial HTML. Verified LCP element: #hero.", lang))}</p>
          <div className={s.table}><table><caption>{(lang === "fr" ? "LCP en millisecondes, cinq chargements indépendants" : localizeValue("LCP in milliseconds, five independent page loads", lang))}</caption><thead><tr><th scope="col">{(lang === "fr" ? "Variante" : localizeValue("Variant", lang))}</th><th scope="col">{(lang === "fr" ? "Mesures" : localizeValue("Samples", lang))}</th><th scope="col">{(lang === "fr" ? "Médiane" : localizeValue("Median", lang))}</th></tr></thead><tbody><tr><th scope="row">{(lang === "fr" ? "Avant" : localizeValue("Before", lang))}</th><td>1060, 1052, 1048, 1060, 1048</td><td>1052 ms</td></tr><tr><th scope="row">{(lang === "fr" ? "Après" : localizeValue("After", lang))}</th><td>60, 52, 52, 56, 56</td><td>56 ms</td></tr></tbody></table></div>
          <p>{(lang === "fr" ? "Reproduction dans le dépôt : scripts/lcp-guide-demo.mjs, routes /before et /after. Ce test isole un délai artificiel ; il ne mesure ni un domaine client ni les performances de production d’Argos. Une optimisation du serveur ou du rendu demanderait une autre expérience." : localizeValue("Reproduce from the repository: scripts/lcp-guide-demo.mjs, /before and /after routes. This test isolates an artificial delay; it measures neither a client domain nor Argos production performance. Server or rendering improvements would require another experiment.", lang))}</p>
        </section>}
        <section className={s.section} id="references" aria-labelledby="references-title">
          <h2 id="references-title">{(lang === "fr" ? "Références officielles" : localizeValue("Official references", lang))}</h2>
          <p>{(lang === "fr" ? "Références consultées le 16 octobre 2026. Exemples à adapter et à tester sur votre périmètre." : localizeValue("References checked on 16 October 2026. Adapt and test the examples within your own scope.", lang))}</p>
          <ul>{data.sources.map(source => <li key={source.href}><a href={source.href}>{source.label}</a></li>)}</ul>
        </section>
        <section className={s.section} aria-labelledby="next-title">
          <h2 id="next-title">{(lang === "fr" ? "Vérifier votre correction" : localizeValue("Verify your fix", lang))}</h2>
          <p>{(lang === "fr" ? "Après vos tests, relancez un audit de la même URL publique et comparez les constats disponibles." : localizeValue("After your tests, rerun an audit of the same public URL and compare available findings.", lang))}</p>
          <p><Link className={s.cta} href={localizedPath("/#audit", lang)}>{(lang === "fr" ? "Lancer un nouvel audit" : localizeValue("Run a new audit", lang))}</Link></p>
          <ul>
            <li><Link href={localizedPath("/methodologie-score#resume", lang)}>{(lang === "fr" ? "Méthode et limites du score Argos" : localizeValue("Argos scoring method and limits", lang))}</Link></li>
            {Object.entries(technicalGuides).filter(([key]) => key !== guide).map(([key, related]) => <li key={key}><Link href={localizedPath(related.route, lang)}>{localizedCopy(related, lang).title}</Link></li>)}
            <li><Link href={localizedPath("/ressources", lang)}>{(lang === "fr" ? "Toutes les ressources" : localizeValue("All resources", lang))}</Link></li>
          </ul>
        </section>
      </div>
    </main><SiteFooter />
  </div>;
}
