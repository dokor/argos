import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import Observations, {resourceLookupCommand} from "./ObservedEvidence";
import {createHash, webcrypto} from 'node:crypto';
import FindingLocation from './FindingLocation';
import PrintableReport from "./PrintableReport";
import {demoReport} from "@/components/marketing/reportDemoFixture";
import {missingLocation} from "./findingPresentation";
import type {ObservedEvidence} from "./types";
const evidence:ObservedEvidence={version:"observed-evidence-v1",source:"runtime",state:"AVAILABLE",inspected:12,truncated:true,redacted:true,
 items:[{kind:"resource",origin:"https://site.example",resourceRef:"0123456789abcdef",status:503,ownership:"FIRST_PARTY"},
 {kind:"element",nodePath:"1,HTML,1,BODY,2,IMG"}]};
describe("collected observations",()=>{
 it('recovers the precise masked request locally instead of suggesting another equally redacted audit',async()=>{
  const target='https://cdn.example/123456789.js?token=local-only';
  const ref=createHash('sha256').update('https://cdn.example/123456789.js').digest('hex').slice(0,16);
  const matches:string[]=[];
  const run=new Function('performance','crypto','TextEncoder','console',`return ${resourceLookupCommand(ref)}`);
  await run({getEntriesByType:()=>[{name:'https://cdn.example/other.js'},{name:target}]},webcrypto,TextEncoder,{log:(value:string)=>matches.push(value)});
  expect(matches).toEqual([target]);
  expect(resourceLookupCommand("';fetch('https://evil.example')")).toBe('');
 });
 it('attributes inline code to the audited path and never substitutes just its origin',()=>{
  const html=renderToStaticMarkup(<Observations lang="fr" pageUrl="https://example.com/javascript_error" evidence={{...evidence,items:[{kind:'resource',origin:'https://example.com',resourceRef:'0123456789abcdef',resourceType:'document',locationScope:'ANALYSED_DOCUMENT',metrics:{sourceLine:8,sourceColumn:52}}]}}/>);
  expect(html).toContain('https://example.com/javascript_error');expect(html).toContain('8:52');expect(html).not.toContain('Le chemin est masqué');
 });
 it('keeps host-root Observatory checks distinct from page-response cookies',()=>{
  const observatory=renderToStaticMarkup(<FindingLocation issue={{id:'observatory.score'} as never} pageUrl="https://example.com/deep/page" lang="fr"/>);
  expect(observatory).toContain('http://example.com/');expect(observatory).not.toContain('/deep/page');
  const cookie=renderToStaticMarkup(<FindingLocation issue={{id:'http.security.cookie_flags',structuredEvidence:{details:[{key:'cookieIssues',text:'1:Secure;3: HttpOnly'}]}} as never} pageUrl="https://example.com/deep/page" lang="fr"/>);
  expect(cookie).toContain('Set-Cookie #1');expect(cookie).toContain('Set-Cookie #3');expect(cookie).not.toContain('Set-Cookie #2');expect(cookie).toContain('/deep/page');
 });
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
