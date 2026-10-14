// Synthetic UI fixtures only; never imported by either production application.
import { readFile } from 'node:fs/promises';
const historical=JSON.parse(await readFile(new URL('../../apps/console-web/src/components/report/fixtures/historical-report.json',import.meta.url),'utf8'));
export const context={siteId:'7',siteUrlId:'9',normalizedUrl:'https://atelier.example/collection/sac-en-coton'};
export const site={siteId:'7',hostname:'atelier.example',urlCount:1,latestActivityAt:'2026-10-13T08:00:00Z',latestRunStatus:'FAILED'};
export const profiles={defaultProfileId:'server-default-v1',items:[{id:'server-default-v1',labelKey:'analysisProfiles.serverDefault',snapshot:{profileId:'server-default-v1',contractVersion:1,settingsProvenance:'COLLECTOR_DEFAULTS',scoringVersion:12,scoringFingerprint:'fixture'}}]};
export function response(path,params=new URLSearchParams()) {
  if(path==='/api/account/me') return {displayName:'Camille · Démonstration',email:'fixture@example.com',verified:true};
  if(path==='/api/account/usage') return {offer:'FREE',period:'2026-10',timezone:'UTC',startsAt:'2026-10-01T00:00:00Z',resetsAt:'2027-01-01T00:00:00Z',used:2,reserved:1,available:17,limit:20,canLaunch:true};
  if(path==='/api/account/analysis-profiles') return profiles;
  if(path==='/api/account/sites') return {items:params.get('q')==='missing' ? [] : [site],nextCursor:null};
  if(path==='/api/account/sites/7') return site;
  if(path==='/api/account/sites/7/urls') return {items:[{siteUrlId:'9',auditId:'1',normalizedUrl:context.normalizedUrl,latestAttempt:{runId:'45',status:'FAILED',createdAt:'2026-10-13T08:00:00Z',finishedAt:'2026-10-13T08:00:25Z'},latestAvailableReport:{runId:'43',publishedAt:'2026-10-12T08:00:25Z',expiresAt:null,globalScore:64,provisional:true}}],nextCursor:null};
  const match=/^\/api\/account\/runs\/(4[2-8])(\/report)?$/.exec(path);
  if(match) {
    const id=match[1],pending=id==='42';
    if(match[2]) {
      if(['42','44','45'].includes(id)) return null;
      const report=structuredClone(historical);
      report.domain='atelier.example';report.url=context.normalizedUrl;report.generatedAt='2026-10-13T08:00:25Z';
      const ratio=id==='43' ? .6 : id==='47' ? 0 : 1;
      report.scores.global=64;report.scores.globalAvailable=id!=='47';
      const aggregate=key=>({key,ratio,expectedWeight:10,measuredWeight:10*ratio,unavailableWeight:10*(1-ratio),blockedWeight:0,notApplicableWeight:0,sufficient:ratio>=.8});
      if(id!=='48') report.scores.coverage={version:'visual-fixture',threshold:.8,provisional:ratio<.8,global:aggregate('global'),domains:['performance','security','seo','a11y'].map(aggregate),checks:[{key:'runtime.load',domain:'performance',module:'runtime',weight:1,state:ratio===0 ? 'UNAVAILABLE':'MEASURED',reason:'VISUAL_FIXTURE',confidence:'HIGH'}]};
      return report;
    }
    return {runId:id,status:pending ? 'RUNNING' : id==='45' ? 'FAILED' : 'COMPLETED',siteId:'7',historyContext:context,createdAt:'2026-10-13T08:00:00Z',startedAt:'2026-10-13T08:00:02Z',finishedAt:pending ? null : '2026-10-13T08:00:25Z',profileSnapshot:JSON.stringify(profiles.items[0].snapshot),moduleStatuses:JSON.stringify(['http','html','runtime','lighthouse','observatory','ssl','zap','tech'].map((id,index)=>({id,label:id,status:pending ? index<2 ? 'COMPLETED' : index===2 ? 'RUNNING' : 'PENDING' : 'COMPLETED'}))),reportAvailability:pending ? 'PENDING' : id==='44' ? 'EXPIRED' : id==='45' ? 'UNAVAILABLE' : 'AVAILABLE'};
  }
  if(path==='/api/account/urls/9/history') return {context,items:[{runId:'43',status:'COMPLETED',createdAt:'2026-10-13T08:00:00Z',finishedAt:'2026-10-13T08:00:25Z',reportAvailable:true,publishedAt:'2026-10-13T08:00:25Z',expiresAt:null,globalScore:64,scoringVersion:12,coverage:.6,provisional:true,comparison:{reason:'METHODOLOGY_CHANGED',globalDelta:20,domains:[],contributions:[],coverageChanged:true}}],nextCursor:null};
  return null;
}
// Optional read-only server for human review; restricted to loopback and synthetic fixtures.
if(process.argv.includes('--serve')) {
  const {createServer}=await import('node:http');
  createServer((req,res)=>{
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    const url=new URL(req.url,'http://127.0.0.1');const data=response(url.pathname,url.searchParams);
    res.writeHead(data ? 200 : 404,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(data??{error:'resource_unavailable'}));
  }).listen(3021,'127.0.0.1',()=>console.log('Read-only Clarte fixture: 127.0.0.1:3021'));
}
