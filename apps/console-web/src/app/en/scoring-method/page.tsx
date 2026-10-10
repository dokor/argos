import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import EditorialMeta from "@/components/marketing/EditorialMeta";
import { localizedMetadata } from "@/lib/i18n/metadata";
import s from "@/app/(fr)/methodologie-score/page.module.scss";

export const metadata = localizedMetadata("/methodologie-score", "en", "How is the Argos website audit score calculated?", "Understand weighted checks, four domains, partial coverage and Lighthouse differences, with a worked example of Argos policy v12.");
const domains = [
  { name: "Performance", description: "Loading and behaviour observed in the browser, using Argos measurements and the Lighthouse Performance score." },
  { name: "Security", description: "HTTPS, protection headers, certificates and signals from external tools when available." },
  { name: "SEO", description: "Technical page signals such as title, description, HTML structure and indexing resources." },
  { name: "Accessibility", description: "Automated HTML checks and the Lighthouse Accessibility score; human review remains essential." },
];
const example = [
  { domain: "Performance", checks: "Console errors: PASS (5/5); JavaScript errors: WARN (3/6)", points: "8 / 11", score: "72.7%" },
  { domain: "Security", checks: "HSTS: PASS (8/8); CSP: FAIL (0/10)", points: "8 / 18", score: "44.4%" },
  { domain: "SEO", checks: "HTML title: PASS (4/4); meta description: WARN (1.5/3)", points: "5.5 / 7", score: "78.6%" },
  { domain: "Accessibility", checks: "Text alternatives: PASS (4/4); HTML language: PASS (2/2)", points: "6 / 6", score: "100%" },
];

export default function EnglishScoreMethod() {
  return <div className={s.page} lang="en"><SiteNav /><main>
    <header className={s.hero}><div className={s.container}>
      <p className={s.eyebrow}>Scoring method · Policy v12</p>
      <h1>How is the Argos audit score calculated?</h1>
      <EditorialMeta route="/methodologie-score" />
      <p className={s.lead}>The score summarizes technical checks performed on one URL at a particular time. It helps identify points to examine, without replacing the findings and measurement coverage.</p>
      <section className={s.summary} id="resume" aria-labelledby="resume-title">
        <h2 id="resume-title">From checks to a decision</h2>
        <ol><li><strong>Applicable checks</strong><span>Available measurements for this URL.</span></li><li><strong>Weighted points</strong><span>A score for each measurable domain.</span></li><li><strong>Overall score</strong><span>The average of the domains, read alongside findings.</span></li></ol>
        <p><strong>Also check coverage.</strong> A missing measurement is not zero. Insufficient coverage makes the score provisional; coverage measures check weights, not the percentage of completed modules.</p>
        <a href="#calcul">See the calculation and coverage</a>
      </section>
    </div></header>
    <div className={s.container}>
      <nav className={s.contents} aria-label="Scoring method contents"><p>On this page</p><a href="#domaines">Four domains</a><a href="#calcul">Calculation</a><a href="#exemple">Worked example</a><a href="#limites">Limits</a></nav>
      <section id="domaines" className={s.section} aria-labelledby="domaines-title">
        <h2 id="domaines-title">Four domains, one overall score</h2>
        <p>Argos groups scorable checks by business domain. Module and tool names indicate where measurements come from; they do not create additional categories.</p>
        <div className={s.domainGrid}>{domains.map(domain => <article key={domain.name} className={s.domainCard}><h3>{domain.name}</h3><p>{domain.description}</p></article>)}</div>
        <p>When all four domains are measurable, each represents 25% of the overall score. If an entire domain cannot be measured, its share is distributed equally among the remaining measurable domains.</p>
      </section>
      <section id="calcul" className={s.section} aria-labelledby="calcul-title">
        <h2 id="calcul-title">How points are awarded</h2>
        <ol className={s.steps}>
          <li><strong>Select applicable checks.</strong> Policy v12 assigns each known key a domain and a specific weight. Informational findings, unknown checks and unavailable measurements do not deduct points.</li>
          <li><strong>Calculate points.</strong> A PASS receives its full weight, WARN half and FAIL zero. Some graduated checks, including Lighthouse category scores, use their continuous ratio from 0 to 1 instead of this status rule. Displayed severity does not determine weight.</li>
          <li><strong>Normalize each domain.</strong> For a measurable domain, Argos divides earned points by the sum of weights of checks actually scored. The average of measurable domains then gives the overall score out of 100.</li>
        </ol>
        <div className={s.formula} aria-label="Scoring formula"><p><strong>Domain score</strong> = earned points ÷ scored check weights × 100</p><p><strong>Overall score</strong> = average of measurable domain scores</p></div>
        <p>The report also shows measurement coverage: measured weights compared with expected catalogue weights, excluding checks that do not apply. Insufficient coverage makes the score provisional. If no domain is measurable, the score is unavailable.</p>
      </section>
      <section className={s.section} aria-labelledby="lighthouse-title">
        <h2 id="lighthouse-title">Argos and Lighthouse measure different things</h2>
        <p>Argos gathers its own HTTP, HTML, browser and security findings. It also imports four Lighthouse category scores when that module responds: Performance, Accessibility, Best Practices and SEO. Each imported score becomes one weighted check in the corresponding Argos domain; the overall Argos score is therefore not the Lighthouse Performance score.</p>
        <p>For example, the Lighthouse Performance score has weight 22 in the Argos Performance domain. A Lighthouse result of 80/100 contributes 17.6 of those 22 points, before other domain checks. Lighthouse computes its own Performance score from weighted metrics, according to its <a href="https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/">published Chrome for Developers method</a>.</p>
      </section>
      <section id="exemple" className={s.section} aria-labelledby="exemple-title">
        <h2 id="exemple-title">Worked example with an unavailable module</h2>
        <p>This deliberately reduced simulation uses real keys and weights from policy v12. It represents no website or client report. Suppose Lighthouse is unavailable: its checks contribute neither earned points nor each domain denominator.</p>
        <div className={s.tableWrap}><table><caption>Illustrative calculation using only the listed checks</caption><thead><tr><th scope="col">Domain</th><th scope="col">Measured checks</th><th scope="col">Points</th><th scope="col">Score</th></tr></thead><tbody>{example.map(row => <tr key={row.domain}><th scope="row">{row.domain}</th><td>{row.checks}</td><td>{row.points}</td><td>{row.score}</td></tr>)}</tbody></table></div>
        <p className={s.result}><strong>Overall score: 74/100</strong> = (72.7 + 44.4 + 78.6 + 100) ÷ 4, rounded to an integer.</p>
        <p>Unavailable Lighthouse is not treated as a failure. All four domains still have measured checks here, so each retains 25% of the overall score. Coverage signals the many missing measurements and makes this score provisional. Other unavailable modules or additional checks would change denominators and the score.</p>
      </section>
      <section id="limites" className={s.section} aria-labelledby="limites-title">
        <h2 id="limites-title">What one score cannot guarantee</h2>
        <ul className={s.limits}><li>The result describes one URL and one moment: content, network, browser and external services can change measurements.</li><li>Scores are most comparable when policy version, fingerprint and coverage are consistent. Reports preserve this information to explain differences.</li><li>A high score does not certify security, accessibility or search visibility for an entire website. Human checks and untested journeys remain necessary.</li></ul>
        <p>For the checks discussed here, see the official references: <a href="https://owasp.org/projects/secure-headers-project">OWASP security headers</a> and <a href="https://www.w3.org/WAI/standards-guidelines/wcag/">W3C WCAG overview</a>. The Argos score is not an assessment of conformance to those frameworks.</p>
      </section>
      <section className={s.next} aria-labelledby="next-title">
        <h2 id="next-title">Explore the diagnosis</h2><p>The method provides context; detailed report findings show what to check and fix.</p>
        <div className={s.links}><Link href="/exemple-rapport">Read a commented example report</Link><Link href="/ressources/audit-technique-gratuit">Understand the technical audit</Link><Link href="/ressources/accessibilite-numerique">Explore digital accessibility</Link><Link href="/ressources">Browse other guides</Link></div>
        <p className={s.cta}>You can also <Link href="/#audit">run a free audit</Link> of your own page.</p>
      </section>
    </div>
  </main><SiteFooter /></div>;
}
