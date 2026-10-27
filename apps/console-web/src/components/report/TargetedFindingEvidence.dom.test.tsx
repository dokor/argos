// @vitest-environment jsdom
import {render,screen,cleanup,within} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {URL as NodeURL} from 'node:url';
import catalogue from './lighthouseAuditCatalogue.json';
import {LangProvider} from '@/lib/i18n/LangContext';
import FindingDetails from './FindingDetails';
import {findingExplanation} from './findingExplanation';
import {documentTargets,pageTargets} from './findingTargets';
import type {Issue,ObservedEvidence} from './types';

// Shared repository fixtures are test inputs, not frontend build dependencies.
// Read them at test runtime so the standalone Docker context can still type-check.
const corpus=JSON.parse(readFileSync(new NodeURL('../../../../api-backend/src/test/resources/targeted-rules/lighthouse-cases.json',import.meta.url),'utf8')) as Array<{
 id:string; expectedTargets?:string[]; semanticTarget?:boolean; before:{observedEvidence:ObservedEvidence};
}>;
const coverage=JSON.parse(readFileSync(new NodeURL('../../../../../docs/report/targeted-rule-coverage.json',import.meta.url),'utf8')) as {
 lighthouse:Array<{id:string;realSites:string[]}>;
};
afterEach(cleanup);
const show=(issue:Issue,lang:'fr'|'en')=>render(<LangProvider initialLang={lang}><FindingDetails pageUrl="https://targeted.example/catalogue" finding={{key:issue.id!,anchor:issue.id!,domain:'performance',sources:[issue.structuredEvidence?.source??'lighthouse'],issue}}/></LangProvider>);
it('accounts for every installed publishable candidate with a targeted case or a named real-site observation',()=>{
 expect(coverage.lighthouse.map(c=>c.id).sort()).toEqual(Object.keys(catalogue.audits).sort());
 for(const row of coverage.lighthouse) expect(corpus.some(c=>c.id===row.id)||row.realSites.length>0).toBe(true);
});

for(const lang of ['fr','en'] as const) for(const c of corpus) it(`${lang}: retains exact collected targets in ${c.id}, outside technical details`,()=>{
 const issue:Issue={id:'lighthouse.audit.'+c.id,title:c.id,severity:'important',impact:'',recommendation:'',structuredEvidence:{source:'lighthouse',observed:c.before.observedEvidence as ObservedEvidence}};
 show(issue,lang);
 const observation=screen.getByRole('region',{name:lang==='fr'?'Qu’a-t-on observé ?':'What was observed?'});
 for(const target of c.expectedTargets??[]) expect(observation.textContent).toContain(target);
 if(c.semanticTarget)expect(observation.textContent).toContain(documentTargets[issue.id!]??pageTargets[issue.id!]?.[lang==='fr'?0:1]);
 expect(observation.textContent).toContain('https://targeted.example/catalogue');
 expect(findingExplanation(issue,lang).specific).toBe(true);
});
for(const lang of ['fr','en'] as const) it(`${lang}: certificate repair and verification distinguish expiry from SNI binding`,()=>{
 const issue:Issue={id:'ssl.certificate.valid',title:'Certificate',severity:'critical',impact:'',recommendation:'',structuredEvidence:{source:'ssl',details:[{key:'certificateProblems',text:'EXPIRED,HOSTNAME_MISMATCH'},{key:'selectedEndpoint',text:'192.0.2.10'}]}};
 show(issue,lang);
 const observation=screen.getByRole('region',{name:lang==='fr'?'Qu’a-t-on observé ?':'What was observed?'});
 expect(observation.textContent).toContain('targeted.example:443');expect(observation.textContent).toContain('192.0.2.10');
 const action=screen.getByRole('region',{name:lang==='fr'?'Par quoi commencer ?':'Where should I start?'});
 expect(action.textContent).toMatch(lang==='fr'?/Renouveler/:/Renew/);expect(action.textContent).toContain('subjectAltName');expect(action.textContent).toContain('SNI');
 const verify=screen.getByRole('region',{name:lang==='fr'?'Comment vérifier ensuite ?':'How can I verify the result?'});
 expect(verify.textContent).toMatch(lang==='fr'?/sans erreur de nom/:/without a name error/);
});
it('document latency recommends only the demonstrated phase, with an explicit repeat measurement',()=>{
 const issue:Issue={id:'lighthouse.audit.document-latency-insight',title:'Latency',severity:'important',impact:'',recommendation:'',structuredEvidence:{source:'lighthouse',details:[{key:'documentCheck.serverResponseIsFast',text:'false'},{key:'documentCheck.usesCompression',text:'true'},{key:'documentCheck.noRedirects',text:'true'}]}};
 show(issue,'fr');
 const action=screen.getByRole('region',{name:'Par quoi commencer ?'});
 expect(action.textContent).toContain('appels amont');expect(action.textContent).not.toMatch(/gzip|redirections intermédiaires/);
 expect(screen.getByRole('region',{name:'Comment vérifier ensuite ?'}).textContent).toContain('même URL au même profil');
});
it('presents ARIA names, robots line, source reflow time and every response occurrence where the user reads the diagnosis',()=>{
 const issue:Issue={id:'lighthouse.audit.aria-valid-attr-value',title:'ARIA',severity:'important',impact:'',recommendation:'',structuredEvidence:{source:'lighthouse',observed:{version:'observed-evidence-v1',source:'lighthouse',state:'AVAILABLE',redacted:true,truncated:false,inspected:2,items:[{kind:'element',selector:'main > button',attributes:['aria-expanded']}]}}};
 show(issue,'en');expect(screen.getByRole('region',{name:'What was observed?'}).textContent).toContain('aria-expanded');
 expect(screen.getByRole('region',{name:'Where should I start?'}).textContent).toContain('"false" when collapsed and "true" when expanded');
 expect(screen.getByRole('region',{name:'How can I verify the result?'}).textContent).toContain('after each change');cleanup();
 for(const c of corpus.filter(c=>['robots-txt','forced-reflow-insight','redirects'].includes(c.id))) {
  show({...issue,id:'lighthouse.audit.'+c.id,structuredEvidence:{source:'lighthouse',observed:c.before.observedEvidence as ObservedEvidence}},'en');
  const observation=screen.getByRole('region',{name:'What was observed?'});
  expect(observation.textContent).toContain(c.id==='robots-txt'?'2:—':c.id==='redirects'?'Navigation step 2':'350 ms');
  if(c.id==='redirects')expect(within(observation).queryByText('Find the URL in my browser')).toBeNull();cleanup();
 }
 show({...issue,id:'zap.alert.10096',structuredEvidence:{source:'zap',details:[{key:'responseBodyLine',text:'2'},{key:'responseBodyColumn',text:'4'},{key:'responseBodyLocations',text:'2:4,3:4'}]}},'fr');
 expect(screen.getByRole('region',{name:'Qu’a-t-on observé ?'}).textContent).toContain('2:4, 3:4');
});
it('shows status 503 and the canonical reason before the raw-evidence accordion',()=>{
 for(const [id,key,text] of [['http.status_code','statusCode','503'],['lighthouse.audit.canonical','diagnosticExplanation','Is not an absolute URL']]) {
  show({id,title:id,severity:'important',impact:'',recommendation:'',structuredEvidence:{source:id.startsWith('http')?'http':'lighthouse',details:[{key,text}]}},'en');
  expect(screen.getByRole('region',{name:'What was observed?'}).textContent).toContain(text);cleanup();
 }
});
