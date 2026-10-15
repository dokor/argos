import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import Observations from "./ObservedEvidence";
import PrintableReport from "./PrintableReport";
import {demoReport} from "@/components/marketing/reportDemoFixture";
import {missingLocation} from "./findingPresentation";
import type {ObservedEvidence} from "./types";
const evidence:ObservedEvidence={version:"observed-evidence-v1",source:"runtime",state:"AVAILABLE",inspected:12,truncated:true,redacted:true,
 items:[{kind:"resource",origin:"https://site.example",resourceRef:"0123456789abcdef",status:503,ownership:"FIRST_PARTY"},
 {kind:"element",nodePath:"1,HTML,1,BODY,2,IMG"}]};
describe("collected observations",()=>{
 for(const lang of ["fr","en"] as const) it("shares observations and limitations with the full PDF "+lang,()=>{
  const report=demoReport(lang);report.issues[0].id="runtime.network.5xx";report.issues[0].structuredEvidence={source:"runtime",observed:evidence};
  const component=renderToStaticMarkup(<Observations evidence={evidence} lang={lang}/>);
  const pdf=renderToStaticMarkup(<PrintableReport report={report} lang={lang} format="full"/>);
  expect(pdf).toContain(component);expect(component).toContain("0123456789abcdef");expect(component).toContain("503");
  expect(component).toContain(lang==="fr"?"Échantillon limité":"Limited sample");
  expect(component).toContain(lang==="fr"?"sont masqués":"are hidden");expect(component).not.toContain("<a");
  expect(missingLocation(report.issues[0],lang)).toBe("");
 });
 it("keeps historical reports unchanged and distinguishes missing observations from no issues",()=>{
  expect(renderToStaticMarkup(<Observations lang="fr"/>)).toBe("");
  const html=renderToStaticMarkup(<Observations evidence={{...evidence,state:"UNAVAILABLE",items:[],truncated:false}} lang="fr"/>);
  expect(html).toContain("Cela ne signifie pas");expect(html).not.toContain("Échantillon limité");
 });
});
