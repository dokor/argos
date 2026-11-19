"use client";
import { localizeValue } from "@/lib/i18n/messages";

import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { demoReport } from "./reportDemoFixture";
import s from "./HomeReportPreview.module.scss";

export default function HomeReportPreview() {
  const { lang, t } = useLang();
  const report = demoReport(lang);
  const issue = report.issues[0];
  const domains = t.report.measurementCoverage.domains as Record<string, string>;

  return (
    <aside className={s.card} aria-labelledby="home-example-title">
      <header className={s.header}>
        <p className={s.eyebrow}>{(lang === "fr" ? "Une action du rapport" : localizeValue("An action from the report", lang))}</p>
        <p className={s.disclosure}>{(lang === "fr" ? "Exemple illustratif" : localizeValue("Illustrative example", lang))}</p>
      </header>

      <div className={s.finding}>
        <div className={s.tags}>
          <span className={s.severity}>{t.report.priorityCards.severity.important}</span>
          <span className={s.category}>{domains[issue.categoryKey ?? "seo"]}</span>
        </div>
        <h2 id="home-example-title" className={s.title}>
          {(lang === "fr" ? "Votre page n’a pas de description." : localizeValue("Your page has no description.", lang))}
        </h2>
        <p className={s.impact}>{issue.impact}</p>

        <div className={s.correction}>
          <p className={s.correctionLabel}>{(lang === "fr" ? "La correction à préparer" : localizeValue("The correction to prepare", lang))}</p>
          <p className={s.recommendation}>{issue.recommendation}</p>
        </div>

        <details className={s.evidence} open>
          <summary>{(lang === "fr" ? "Voir la preuve HTML illustrative" : localizeValue("View the illustrative HTML evidence", lang))}</summary>
          <pre><code>{issue.evidence}</code></pre>
        </details>
      </div>

      <section className={s.scoreSection} aria-labelledby="home-example-scores">
        <p id="home-example-scores" className={s.scoreLabel}>
          {(lang === "fr" ? "Les quatre domaines analysés" : localizeValue("The four areas analysed", lang))}
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
          <span>{(lang === "fr" ? "Voir le rapport et ses corrections" : localizeValue("View the report and its corrections", lang))}</span>
          <span className={s.arrow} aria-hidden="true">→</span>
        </Link>
        <p className={s.disclosure}>{(lang === "fr" ? "Chiffres et preuve synthétiques." : localizeValue("Synthetic figures and evidence.", lang))}</p>
      </footer>
    </aside>
  );
}
