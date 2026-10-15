"use client";
import { cleanEvidence, findingEditorial } from "@/components/report/findingCatalogue";
import type { CommonFinding } from "@/lib/connected/contracts";
import { useDomainText } from "./DomainUi";
import d from "./Domains.module.scss";

export default function CommonFindingContent({ finding }: { finding: CommonFinding }) {
  const { lang, c } = useDomainText();
  const content = findingEditorial(finding.ruleKey, lang);
  return <>
    <h3>{c.impact}</h3><p>{content.impact}</p>
    <h3>{c.recommendation}</h3><p>{content.recommendation}</p>
    <details className={d.source}><summary>{lang === "fr" ? "Textes source conservés (langue d’origine)" : "Retained source text (original language)"}</summary>
      <p><code>{finding.ruleKey}</code></p>
      {finding.title && <p>{cleanEvidence(finding.title)}</p>}
      {finding.impact && <p>{cleanEvidence(finding.impact)}</p>}
      {finding.recommendation && <p>{cleanEvidence(finding.recommendation)}</p>}
    </details>
  </>;
}
