// @vitest-environment jsdom
import {render,screen,within} from '@testing-library/react';
import {expect,it} from 'vitest';
import {LangProvider} from '@/lib/i18n/LangContext';
import FindingDetails from './FindingDetails';
import ObservedEvidence from './ObservedEvidence';
import {findingExplanation} from './findingExplanation';
import type {Issue,ObservedEvidence as Evidence} from './types';

it('puts the actual TLS endpoint and expiry beside the correction rather than in raw JSON',()=>{
 const issue:Issue={id:'ssl.certificate.expiry_days',title:'Expiry',impact:'',recommendation:'',severity:'important',evidence:'{notAfterMs=1795677747000}',structuredEvidence:{source:'ssl',measurement:{value:30,unit:'days'},details:[{key:'selectedEndpoint',text:'203.0.113.42'},{key:'notAfterMs',text:'1795677747000'}]}};
 render(<LangProvider initialLang="fr"><FindingDetails pageUrl="https://example.com/page" finding={{key:issue.id!,anchor:'expiry',domain:'security',sources:['ssl'],issue}}/></LangProvider>);
 const observation=screen.getByRole('region',{name:'Qu’a-t-on observé ?'});
 expect(within(observation).getByText('example.com:443')).toBeVisible();
 expect(within(observation).getByText('203.0.113.42')).toBeVisible();
 expect(within(observation).getByText('26 novembre 2026')).toBeVisible();
 expect(observation.textContent).not.toContain('notAfterMs=');
});

it('groups source coordinates under their actual file without losing a position or estimated savings',()=>{
 const evidence:Evidence={version:'observed-evidence-v1',source:'lighthouse',state:'AVAILABLE',redacted:true,truncated:false,inspected:10,items:[
  {kind:'resource',origin:'https://example.com',resourceRef:'0123456789abcdef',resourcePath:'/app.js',metrics:{wastedBytes:13000}},
  {kind:'resource',origin:'https://example.com',resourceRef:'0123456789abcdef',resourcePath:'/app.js',metrics:{sourceLine:31,sourceColumn:11593}},
  {kind:'resource',origin:'https://example.com',resourceRef:'0123456789abcdef',resourcePath:'/app.js',metrics:{sourceLine:31,sourceColumn:10981}},
 ]};
 render(<ObservedEvidence evidence={evidence} lang="en"/>);
 expect(screen.getAllByText('https://example.com/app.js')).toHaveLength(1);
 expect(screen.getByText('31:11593, 31:10981')).toBeVisible();
 expect(screen.getByText('13 kB')).toBeVisible();
});

it('keeps distinct reflow costs attached to their own source positions',()=>{
 const evidence:Evidence={version:'observed-evidence-v1',source:'lighthouse',state:'AVAILABLE',redacted:true,truncated:false,inspected:2,items:[
  {kind:'resource',origin:'https://example.com',resourceRef:'0123456789abcdef',resourcePath:'/app.js',metrics:{sourceLine:3,sourceColumn:5,reflowTime:350}},
  {kind:'resource',origin:'https://example.com',resourceRef:'0123456789abcdef',resourcePath:'/app.js',metrics:{sourceLine:8,sourceColumn:2,reflowTime:20}},
 ]};
 const {container}=render(<ObservedEvidence evidence={evidence} lang="en"/>);
 const items=container.querySelectorAll('li');expect(items).toHaveLength(2);
 expect(items[0].textContent).toContain('350 ms');expect(items[0].textContent).toContain('3:5');
 expect(items[1].textContent).toContain('20 ms');expect(items[1].textContent).toContain('8:2');
});

it('uses the recorded cache reason and preserves private-response protections',()=>{
 const issue:Issue={id:'lighthouse.audit.bf-cache',title:'Cache',impact:'',recommendation:'',severity:'important',structuredEvidence:{source:'lighthouse',details:[{key:'bfCacheReasons',text:'MainResourceHasCacheControlNoStore,JsNetworkRequestReceivedCacheControlNoStoreResource'}]}};
 expect(findingExplanation(issue,'fr').observation).toContain('Cache-Control: no-store');
 expect(findingExplanation(issue,'fr').steps.join(' ')).toContain('données personnelles, le conserver');
 expect(findingExplanation(issue,'en').steps.join(' ')).toContain('exact URLs are not retained');
});

it('keeps both CSP reasons from the real plugin group beside its actual page and header',()=>{
 const issue:Issue={id:'zap.alert.10055',title:'CSP',impact:'',recommendation:'',severity:'important',structuredEvidence:{source:'zap',details:[{key:'policyFindings',text:'CSP: Wildcard Directive: overly broadly defined: img-src CSP: style-src unsafe-inline: style-src includes unsafe-inline.'}]}};
 render(<LangProvider initialLang="fr"><FindingDetails pageUrl="https://example.com/" finding={{key:issue.id!,anchor:'csp',domain:'security',sources:['zap'],issue}}/></LangProvider>);
 const observation=screen.getByRole('region',{name:'Qu’a-t-on observé ?'});
 expect(within(observation).getByText('Content-Security-Policy')).toBeVisible();
 expect(within(observation).getByText('img-src, style-src')).toBeVisible();
 expect(observation.textContent).toContain('protocole entier (https:)');
 expect(observation.textContent).toContain('unsafe-inline');
 expect(within(observation).getByText('https://example.com/')).toBeVisible();
});
