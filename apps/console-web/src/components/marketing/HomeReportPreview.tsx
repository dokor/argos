"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { demoReport } from "./reportDemoFixture";
import s from "./HomeReportPreview.module.scss";
export default function HomeReportPreview() {
  const { lang, t } = useLang(), fr = lang === "fr";
  const report = demoReport(lang), issue = report.issues[0];
  const domains = t.report.measurementCoverage.domains as Record<string, string>;
  return <aside className={s.card} aria-labelledby="home-example-title">
    <p className={s.disclosure}>{fr ? "Exemple illustratif · chiffres synthétiques" : "Illustrative example · synthetic figures"}</p>
    <h2 id="home-example-title">{fr ? "Une correction à préparer" : "A correction to plan"}</h2>
    <dl className={s.scores}>{report.scores.byCategory.map(category => <div key={category.key}><dt>{domains[category.key]}</dt><dd>{category.score}/100</dd></div>)}</dl>
    <article className={s.finding}><p className={s.severity}>{t.report.priorityCards.severity.important}</p><h3>{issue.title}</h3>
      <p>{issue.impact}</p><p><strong>{fr ? "Preuve illustrative" : "Illustrative evidence"}</strong></p><pre><code>{issue.evidence}</code></pre>
      <p><strong>{fr ? "Correction" : "Correction"}</strong> — {issue.recommendation}</p>
    </article>
    <Link href="/exemple-rapport">{fr ? "Lire l’exemple complet et vérifier la correction" : "Read the full example and verify the correction"}</Link>
  </aside>;
}
