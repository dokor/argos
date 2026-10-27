// Manual, read-only verification against the same fixed public demonstration pages as LiveAudit.
// This checks actual response bytes/headers, not just the presence of report prose.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const targets={
 'js-error':'https://the-internet.herokuapp.com/javascript_error',
 'broken-images':'https://the-internet.herokuapp.com/broken_images',
 'w3c-bad':'https://www.w3.org/WAI/demos/bad/before/home.html',
 'mixed-content':'https://mixed.badssl.com/',
};
const output=[];
const resources=new Map();
for(const [id,url] of Object.entries(targets)) {
 const report=JSON.parse(await readFile(`outputs/live-audit/${id}/report.json`,'utf8'));
 assert.equal(report.url,url);
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)}), body=await response.text();
 assert.equal(response.status,200);
 const details=key=>Object.fromEntries((report.issues.find(i=>i.id===key)?.structuredEvidence?.details??[]).map(d=>[d.key,d.text]));
 const evidence=key=>report.issues.find(i=>i.id===key)?.structuredEvidence?.observed?.items??[];
 const facts={id,findings:report.issues.length,status:response.status,checks:[]};
 for(const issue of report.issues)for(const item of issue.structuredEvidence?.observed?.items??[]) {
  if(!item.resourcePath||item.resourcePath==='/'||item.origin!==new URL(url).origin)continue;
  const target=item.origin+item.resourcePath;
  if(!resources.has(target))resources.set(target,[]);
  resources.get(target).push({key:issue.id,metrics:item.metrics});
 }
 if(id==='js-error') {
  for(const key of ['runtime.js.errors','lighthouse.audit.errors-in-console']) {
   const point=evidence(key).find(e=>e.locationScope==='ANALYSED_DOCUMENT');assert.ok(point,key);
   const line=body.split('\n')[point.metrics.sourceLine-1];
   assert.ok(line?.includes('document.propertyThatDoesNotExist.xyz'));assert.ok(point.metrics.sourceColumn<=line.length);
   facts.checks.push({key,line:point.metrics.sourceLine,column:point.metrics.sourceColumn,containsFailingExpression:true});
  }
 }
 if(id==='broken-images') {
  for(const path of ['/asdf.jpg','/hjkl.jpg']) {
   assert.ok(evidence('runtime.console.errors').some(e=>e.resourcePath===path));
   const missing=await fetch(new URL(path,url),{signal:AbortSignal.timeout(15000)});await missing.arrayBuffer();
   assert.equal(missing.status,404);facts.checks.push({path,status:missing.status});
  }
  const script='/js/vendor/298279967.js';
  assert.ok(body.includes(script));
  const ref=createHash('sha256').update(new URL(script,url).href).digest('hex').slice(0,16);
  assert.ok(evidence('lighthouse.audit.cache-insight').some(e=>e.resourceRef===ref&&!e.resourcePath));
  facts.checks.push({maskedStaticScriptMatchesObservedReference:true});
 }
 if(id==='mixed-content') {
  const point=details('zap.alert.10040'),line=body.split('\n')[Number(point.responseBodyLine)-1];
  assert.ok(line.slice(Number(point.responseBodyColumn)-1).startsWith('http://mixed.badssl.com/image.jpg'));
  assert.ok(evidence('lighthouse.audit.is-on-https').some(e=>e.origin==='http://mixed.badssl.com'&&e.resourcePath==='/image.jpg'));
  const banner=details('tech.security.version_disclosure').exposed.match(/Server: ([^\]]+)/)?.[1];
  assert.ok(banner&&response.headers.get('server')?.includes(banner));
  facts.checks.push({mixedContentLine:Number(point.responseBodyLine),column:Number(point.responseBodyColumn),serverBannerMatches:true});
 }
 for(const [key,header] of [['http.security.csp','content-security-policy'],['http.security.hsts','strict-transport-security'],['http.security.referrer_policy','referrer-policy'],['http.security.permissions_policy','permissions-policy']]) {
  if(details(key).present==='false') {assert.ok(!response.headers.get(header));facts.checks.push({header,absent:true});}
 }
 if(details('http.security.cookie_flags').cookieIssues) {
  const cookies=response.headers.getSetCookie();
  for(const row of details('http.security.cookie_flags').cookieIssues.split(';')) {
   const [ordinal,flags]=row.split(':');assert.ok(cookies[Number(ordinal)-1]);
   for(const flag of flags.trim().split(' '))assert.ok(!new RegExp(`;\\s*${flag}(?:;|$)`,'i').test(cookies[Number(ordinal)-1]));
   facts.checks.push({cookieOrdinal:Number(ordinal),missing:flags.trim()});
  }
 }
 if(details('http.seo.sitemap').probePath) {
  const probe=new URL(details('http.seo.sitemap').probePath,url);assert.equal(probe.origin,new URL(url).origin);
  const result=await fetch(probe,{signal:AbortSignal.timeout(15000)});await result.arrayBuffer();
  assert.equal(result.status,Number(details('http.seo.sitemap').status));facts.checks.push({path:probe.pathname,status:result.status});
 }
 output.push(facts);
}
const files=[];
for(const [url,uses] of resources) {
 const result=await fetch(url,{signal:AbortSignal.timeout(15000)}),source=await result.text();
 const optimisation=uses.some(u=>u.key?.startsWith('lighthouse.audit.')&&!u.key.includes('errors-in-console'));
 if(optimisation)assert.equal(result.status,200,url);
 const positions=uses.filter(u=>u.metrics?.sourceLine&&/\.(?:m?js|css)$/.test(new URL(url).pathname)&&result.status===200).map(u=>u.metrics);
 for(const point of positions)assert.ok(source.split('\n')[point.sourceLine-1]?.length>=point.sourceColumn,url);
 files.push({url,status:result.status,positionsChecked:positions.length,findings:[...new Set(uses.map(u=>u.key))]});
}
await writeFile('outputs/live-audit/demo-target-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),sites:output,resources:files},null,2));
console.log(JSON.stringify({sites:output,resources:files},null,2));
