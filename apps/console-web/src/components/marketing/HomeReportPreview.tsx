import Link from "@/components/LocalizedLink";
import french from "@/lib/i18n/fr.json";
import english from "@/lib/i18n/en.json";
import type { Lang } from "@/lib/i18n/routes";
import { demoReport } from "./reportDemoFixture";
import s from "./HomeReportPreview.module.scss";

export default function HomeReportPreview({ lang = "fr" }: { lang?: Lang }) {
  const t = lang === "en" ? english : french;
  const fr = lang === "fr";
  const report = demoReport(lang);
  const issue = report.issues[0];
  const domains = t.report.measurementCoverage.domains as Record<string, string>;

  return (
    <aside className={s.card} aria-labelledby="home-example-title">
      <header className={s.header}>
        <p className={s.eyebrow}>{fr ? "Une action du rapport" : "An action from the report"}</p>
        <p className={s.disclosure}>{fr ? "Exemple illustratif" : "Illustrative example"}</p>
      </header>

      <div className={s.finding}>
        <div className={s.tags}>
          <span className={s.severity}>{t.report.priorityCards.severity.important}</span>
          <span className={s.category}>{domains[issue.categoryKey ?? "seo"]}</span>
        </div>
        <h2 id="home-example-title" className={s.title}>
          {fr ? "Votre page n’a pas de description." : "Your page has no description."}
        </h2>
        <p className={s.impact}>{issue.impact}</p>

        <div className={s.correction}>
          <p className={s.correctionLabel}>{fr ? "La correction à préparer" : "The correction to prepare"}</p>
          <p className={s.recommendation}>{issue.recommendation}</p>
        </div>

        <details className={s.evidence} open>
          <summary>{fr ? "Voir la preuve HTML illustrative" : "View the illustrative HTML evidence"}</summary>
          <pre><code>{issue.evidence}</code></pre>
        </details>
      </div>

      <section className={s.scoreSection} aria-labelledby="home-example-scores">
        <p id="home-example-scores" className={s.scoreLabel}>
          {fr ? "Les quatre domaines analysés" : "The four areas analysed"}
        </p>
        <dl className={s.scores}>
          {report.scores.byCategory.map(category => (
            <div key={category.key} className={s.score}>
              <dt>{domains[category.key]}</dt>
              <dd>{category.score}<span className={s.scoreUnit}>/100</span></dd>
              <span className={s.scoreTrack} aria-hidden="true">
                <span style={{ width: `${category.score}%` }} />
              </span>
            </div>
          ))}
        </dl>
      </section>

      <footer className={s.footer}>
        <Link href="/exemple-rapport" className={s.reportLink}>
          <span>{fr ? "Voir le rapport et ses corrections" : "View the report and its corrections"}</span>
          <span className={s.arrow} aria-hidden="true">→</span>
        </Link>
        <p className={s.disclosure}>{fr ? "Chiffres et preuve synthétiques." : "Synthetic figures and evidence."}</p>
      </footer>
    </aside>
  );
}
