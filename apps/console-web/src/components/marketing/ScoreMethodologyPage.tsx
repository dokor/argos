import Link from "@/components/PageLink";
import EditorialMeta from "./EditorialMeta";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { localizedPath, type Lang } from "@/lib/i18n/routes";
import { SCORE_POLICY_VERSION, scoreMethodologyCopy } from "./scoreMethodologyCopy";
import s from "@/app/(fr)/methodologie-score/page.module.scss";

const contentsIds = ["domaines", "calcul", "exemple", "limites"];
const nextRoutes = ["/exemple-rapport", "/ressources/audit-technique-gratuit", "/ressources/accessibilite-numerique", "/ressources"];

export default function ScoreMethodologyPage({ lang }: { lang: Lang }) {
  const c = scoreMethodologyCopy[lang];
  return (
    <div className={s.page} lang={lang}>
      <SiteNav />
      <main lang={lang}>
        <header className={s.hero}>
          <div className={s.container}>
            <p className={s.eyebrow}>{c.eyebrow} v{SCORE_POLICY_VERSION}</p>
            <h1>{c.title}</h1>
            <EditorialMeta route="/methodologie-score" />
            <p className={s.lead}>{c.lead}</p>
            <section className={s.summary} id="resume" aria-labelledby="resume-title">
              <h2 id="resume-title">{c.summaryTitle}</h2>
              <ol>{c.summarySteps.map(step => <li key={step.title}><strong>{step.title}</strong><span>{step.text}</span></li>)}</ol>
              <p><strong>{c.coverageLabel}</strong>{c.coverageSummary}</p>
              <a href="#calcul">{c.calculationLink}</a>
            </section>
          </div>
        </header>
        <div className={s.container}>
          <nav className={s.contents} aria-label={c.contentsLabel}>
            <p>{c.contentsTitle}</p>
            {c.contents.map((label, i) => <a key={contentsIds[i]} href={`#${contentsIds[i]}`}>{label}</a>)}
          </nav>
          <section id="domaines" className={s.section} aria-labelledby="domaines-title">
            <h2 id="domaines-title">{c.domainsTitle}</h2>
            <p>{c.domainsIntro}</p>
            <div className={s.domainGrid}>{c.domains.map(domain => <article key={domain.name} className={s.domainCard}><h3>{domain.name}</h3><p>{domain.description}</p></article>)}</div>
            <p>{c.domainShares}</p>
          </section>
          <section id="calcul" className={s.section} aria-labelledby="calcul-title">
            <h2 id="calcul-title">{c.calculationTitle}</h2>
            <ol className={s.steps}>{c.calculationSteps.map(step => <li key={step.title}><strong>{step.title}</strong>{step.text}</li>)}</ol>
            <div className={s.formula} aria-label={c.formulaLabel}>
              <p><strong>{c.domainScoreLabel}</strong>{c.domainFormula}</p>
              <p><strong>{c.overallScoreLabel}</strong>{c.overallFormula}</p>
            </div>
            <p>{c.coverage}</p>
          </section>
          <section className={s.section} aria-labelledby="lighthouse-title">
            <h2 id="lighthouse-title">{c.lighthouseTitle}</h2>
            <p>{c.lighthouseIntro}<em>{c.lighthouseEmphasis}</em>{c.lighthouseEnd}</p>
            <p>{c.lighthouseExample}<a href="https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/" target="_blank" rel="noopener noreferrer">{c.lighthouseSource}</a>.</p>
          </section>
          <section id="exemple" className={s.section} aria-labelledby="exemple-title">
            <h2 id="exemple-title">{c.exampleTitle}</h2>
            <p>{c.exampleIntro}</p>
            <div className={s.tableWrap}>
              <table>
                <caption>{c.caption}</caption>
                <thead><tr>{c.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
                <tbody>{c.example.map(row => <tr key={row.domain}><th scope="row">{row.domain}</th><td>{row.checks}</td><td>{row.points}</td><td>{row.score}</td></tr>)}</tbody>
              </table>
            </div>
            <section className={s.exampleCards} aria-label={c.caption}>
              <h3>{c.caption}</h3>
              {c.example.map(row => <article key={row.domain}>
                <h4>{row.domain}</h4>
                <dl>{[row.checks, row.points, row.score].map((value, index) => <div key={c.columns[index + 1]}><dt>{c.columns[index + 1]}</dt><dd>{value}</dd></div>)}</dl>
              </article>)}
            </section>
            <p className={s.result}><strong>{c.result}</strong>{c.resultFormula}</p>
            <p>{c.exampleCoverage}</p>
          </section>
          <section id="limites" className={s.section} aria-labelledby="limites-title">
            <h2 id="limites-title">{c.limitsTitle}</h2>
            <ul className={s.limits}>{c.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
            <p>{c.referencesIntro}<a href="https://owasp.org/projects/secure-headers-project" target="_blank" rel="noopener noreferrer">{c.securitySource}</a>{c.referencesJoin}<a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noopener noreferrer">{c.accessibilitySource}</a>{c.referencesEnd}</p>
          </section>
          <section className={s.next} aria-labelledby="next-title">
            <h2 id="next-title">{c.nextTitle}</h2>
            <p>{c.nextIntro}</p>
            <div className={s.links}>{c.nextLinks.map((label, i) => <Link key={nextRoutes[i]} href={localizedPath(nextRoutes[i], lang)}>{label}</Link>)}</div>
            <p className={s.cta}>{c.ctaIntro}<Link href={localizedPath("/#audit", lang)}>{c.ctaLink}</Link>{c.ctaEnd}</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
