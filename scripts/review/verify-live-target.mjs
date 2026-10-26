import {readFile,writeFile} from 'node:fs/promises';
import https from 'node:https';
import assert from 'node:assert/strict';
const report=JSON.parse(await readFile('outputs/live-audit/report.json','utf8'));
const resources=[...new Set(report.issues.flatMap(issue=>issue.structuredEvidence?.observed?.items??[]).filter(item=>item.resourcePath?.startsWith('/_next/static/')).map(item=>item.origin+item.resourcePath))];
assert.ok(resources.length > 0, 'No resource target to verify in this collection');
const verified=[];
for(const url of resources) {
 if(new URL(url).origin!=='https://argos.lelouet.fr') throw Error('Unexpected target');
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 const source=await response.text();
 assert.equal(response.status,200,`Unavailable resource: ${url}`);
 assert.match(response.headers.get('content-type')??'',url.endsWith('.css')?/text\/css/:/javascript/);
 const positions=report.issues.flatMap(issue=>issue.structuredEvidence?.observed?.items??[]).filter(item=>item.origin+item.resourcePath===url&&item.metrics?.sourceLine).map(item=>({line:item.metrics.sourceLine,column:item.metrics.sourceColumn}));
 const coordinates=positions.map(pos=>({...pos,inBounds:!!source.split('\n')[pos.line-1]&&pos.column<=source.split('\n')[pos.line-1].length}));
 assert.ok(coordinates.every(pos=>pos.inBounds),`Unusable source position: ${url}`);
 verified.push({url,status:response.status,type:response.headers.get('content-type'),positions:coordinates});
}
const certificate=await new Promise((resolve,reject)=>{const req=https.get('https://argos.lelouet.fr/',response=>{const cert=response.socket.getPeerCertificate();resolve({authorized:response.socket.authorized,subject:cert.subject.CN,validTo:cert.valid_to});response.resume();});req.on('error',reject);req.setTimeout(15000,()=>req.destroy(Error('Timeout')));});
assert.equal(certificate.authorized, true, 'TLS verification failed');
assert.equal(certificate.subject, 'argos.lelouet.fr');
await writeFile('outputs/live-audit/target-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),certificate,resources:verified},null,2));
console.log(JSON.stringify({certificate,resources:verified}));
