import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const catalogue=await read('apps/console-web/src/components/report/lighthouseAuditCatalogue.json');
const corpus=await read('apps/api-backend/src/test/resources/targeted-rules/lighthouse-cases.json');
const inventory=await read('docs/report/rule-inventory.json');
const sites=[];
for(const [name,file] of [['argos','outputs/live-audit/report.json'],...['w3c-bad','js-error','broken-images','mixed-content'].map(name=>[name,`outputs/live-audit/${name}/report.json`])]) {
 const report=await read(file);sites.push({name,url:report.url,keys:[...new Set(report.issues.map(i=>i.id))].sort()});
}
const remainingFindings=new Set(['html.title','http.final_url.https','http.headers.content_type','http.redirect.count','http.redirect.to_https','http.seo.robots_txt','http.status_code','runtime.network.5xx','runtime.network.bytes_estimated','runtime.network.request_count','runtime.network.third_party_errors','ssl.certificate.valid','ssl.protocols.tls12']);
const lighthouse=Object.keys(catalogue.audits).map(id=>{
 const test=corpus.find(c=>c.id===id),real=sites.filter(s=>s.keys.includes('lighthouse.audit.'+id)).map(s=>s.name);
 assert.ok(test||real.length,`Uncovered Lighthouse candidate: ${id}`);
 return {id,realSites:real,...(test?{targetedMethod:test.method,targetedChange:test.change,targets:test.expectedTargets,scope:test.semanticTarget,relatedDiagnostic:test.related}:{})};
});
const staticRules=inventory.map(r=>({key:r.key,realSites:sites.filter(s=>s.keys.includes(r.key)).map(s=>s.name),
 review:sites.some(s=>s.keys.includes(r.key))?'real-site-finding':remainingFindings.has(r.key)?'targeted-analyzer-regression':r.key.endsWith('.collect')||r.key==='http.errors'?'availability-not-a-site-finding':'informational-not-a-site-finding'}));
const evidence={version:'targeted-rule-coverage-v1',lighthouseVersion:catalogue.lighthouseVersion,
 limits:['No queue/database/publication end-to-end test','Performance artifact replays do not measure speed improvements','115 bounded Lighthouse candidates, not all future rules','ZAP plugin IDs are open-ended; generic response locations, source guidance and known aliases have regression tests','No PDF validation'],
 sites,lighthouse,staticRules};
await writeFile('docs/report/targeted-rule-coverage.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({lighthouse:lighthouse.length,targeted:corpus.length,static:staticRules.length,remainingFindingCases:staticRules.filter(r=>r.review==='targeted-analyzer-regression').length,excluded:staticRules.filter(r=>r.review.includes('not-a-site')).length}));
