import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ModuleExecutionFacts from "./ModuleExecutionFacts";
import PrintableReport from "./PrintableReport";
import historical from "./fixtures/historical-report.json";
import type { Report } from "./types";
const report = historical as Report;
const execution = { total: 8, completed: 6, partial: 0, failed: 2, skipped: 0, pending: 0, running: 0, terminalPercent: 100 };
for (const lang of ["fr", "en"] as const) {
  it(`separates 75% success, 100% terminal progress and two failures in ${lang} and exports`, () => {
    const scores = { ...report.scores, completeness: 75, moduleExecution: execution };
    const html = renderToStaticMarkup(<dl><ModuleExecutionFacts scores={scores} lang={lang}/></dl>);
    expect(html).toContain("75 %"); expect(html).toContain("100 %"); expect(html).toContain("2 / 8");
    expect(html).toContain(lang === "fr" ? "Modules entièrement réussis" : "Fully successful modules");
    for(const format of ["summary","full"] as const) {
      const exported = renderToStaticMarkup(<PrintableReport report={{...report,scores}} lang={lang} format={format}/>);
      expect(exported).toContain(html.slice(4,-5));
    }
  });
  it(`does not fabricate terminal progress for historical reports in ${lang}`, () => {
    const html=renderToStaticMarkup(<ModuleExecutionFacts scores={{...report.scores,completeness:75}} lang={lang}/>);
    expect(html).toContain("75 %"); expect(html).not.toContain("100 %"); expect(html).not.toContain("/ 8");
  });
}
