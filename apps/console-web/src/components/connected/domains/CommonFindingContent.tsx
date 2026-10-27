"use client";
import { cleanEvidence, findingEditorial } from "@/components/report/findingCatalogue";
import FindingGuide from "@/components/report/FindingGuide";
import type { CommonFinding } from "@/lib/connected/contracts";
import { useDomainText } from "./DomainUi";
import d from "./Domains.module.scss";

export default function CommonFindingContent({ finding }: { finding: CommonFinding }) {
  const { lang, c } = useDomainText();
  const content = findingEditorial(finding.ruleKey, lang);
  return <>
    <div className={d.findingBody}>
      <div><h3>{c.impact}</h3><p>{content.impact}</p></div>
      <div><h3>{c.recommendation}</h3><FindingGuide issue={{ id: finding.ruleKey, title: finding.title ?? finding.ruleKey, severity: "important", impact: finding.impact ?? "", recommendation: finding.recommendation ?? "" }} lang={lang} parts={["correction", "verification"]} heading={4}/></div>
    </div>
    <p>{lang === "fr" ? "Ouvrez une page concernée pour retrouver les fichiers, les éléments et les mesures propres à son analyse. Un même contrôle peut concerner des ressources différentes selon la page." : "Open an affected page to locate the files, elements and measurements from its analysis. The same check may concern different resources on each page."}</p>
    <details className={d.source}><summary>{lang === "fr" ? "Textes source conservés (langue d’origine)" : "Retained source text (original language)"}</summary>
      <p><code>{finding.ruleKey}</code></p>
      {finding.title && <p>{cleanEvidence(finding.title)}</p>}
      {finding.impact && <p>{cleanEvidence(finding.impact)}</p>}
      {finding.recommendation && <p>{cleanEvidence(finding.recommendation)}</p>}
    </details>
  </>;
}
