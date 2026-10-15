// Synthetic evidence only. Requires a production build with API_BASE=http://127.0.0.1:3101.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
const root=path.resolve('apps/console-web'),require=createRequire(path.join(root,'package.json')),ts=require('typescript');
async function module(file){const source=fs.readFileSync(file,'utf8');return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));}
const {demoReport}=await module(path.join(root,'src/components/marketing/reportDemoFixture.ts'));
const {buildReportModel}=await module(path.join(root,'src/components/report/reportModel.ts'));
const clone=value=>structuredClone(value);
const complete=demoReport('fr');complete.scores.global=95;
complete.issues.push({id:'runtime.network.failed_requests',categoryKey:'performance',module:'runtime',severity:'critical',title:'Failed requests',impact:'Synthetic fixture',recommendation:'',confidence:'LOW',structuredEvidence:{source:'runtime',measurement:{value:3,unit:'count'},details:[{key:'sample',text:'https://user:private@cdn.example/'+('resource-'.repeat(35))+'.js?token=private#fragment'}]}});
const limited=clone(complete);limited.scores.coverage.provisional=true;Object.assign(limited.scores.coverage.domains.find(d=>d.key==='a11y'),{ratio:.4,sufficient:false});
const aggregate=clone(complete);aggregate.issues.push({id:'lighthouse.score.performance',categoryKey:'performance',module:'lighthouse',severity:'critical',title:'Performance score',impact:'Tool threshold',recommendation:'',confidence:'HIGH'},{id:'lighthouse.audit.unused-css-rules',categoryKey:'performance',module:'lighthouse',severity:'important',title:'Reduce unused CSS',impact:'Tool diagnosis',recommendation:'',confidence:'HIGH',structuredEvidence:{source:'lighthouse',measurement:{value:18000,unit:'bytes'}}});aggregate.summary.priorities=[{severity:'critical',title:'Performance score',impact:'Tool threshold',findingKey:'lighthouse.score.performance',categoryKey:'performance',rank:1,confidence:'HIGH'},...aggregate.summary.priorities];
const unavailable=clone(complete);unavailable.issues=[];unavailable.summary.priorities=[];unavailable.scores.globalAvailable=false;unavailable.scores.coverage.provisional=true;for(const d of [unavailable.scores.coverage.global,...unavailable.scores.coverage.domains])Object.assign(d,{ratio:0,available:false,sufficient:false});
const historical=JSON.parse(fs.readFileSync(path.join(root,'src/components/report/fixtures/historical-report.json'),'utf8'));
const unknown=clone(complete);unknown.issues.push({id:'lighthouse.audit.future-diagnostic',categoryKey:'performance',module:'lighthouse',severity:'important',title:'English technical title '.repeat(12),impact:'English technical title',recommendation:'Check this',confidence:'UNKNOWN'});
const introduced=clone(complete);introduced.introduction={author:'Atelier conseil fictif',context:'Cette note humaine concerne uniquement la page produit. Nous proposons d’examiner les deux constats sélectionnés ensemble.',findingKeys:['html.title','html.meta.description.present'],nextStep:'Vérifier les preuves, préciser le périmètre et convenir des corrections à estimer.',publishedAt:'2026-10-13T10:00:00Z'};
const fixtures={complete,limited,aggregate,unavailable,historical,unknown,introduced};
const tokenFor=key=>'review-prospect-'+key+'-fictional-report';
const tokens=new Map(Object.keys(fixtures).map(k=>[tokenFor(k),k]));
const owner='synthetic-owner-session';let writes=0;
const api=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','private, no-store');
 const pathname=new URL(req.url,'http://localhost').pathname;
 const publicMatch=/^\/api\/reports\/([^/]+)$/.exec(pathname);if(publicMatch&&tokens.has(publicMatch[1]))return res.end(JSON.stringify(fixtures[tokens.get(publicMatch[1])]));
 const noteMatch=/^\/api\/account\/report-introduction\/([^/]+)$/.exec(pathname);
 if(noteMatch&&tokens.has(noteMatch[1])&&req.headers.authorization==='Bearer '+owner){
  const report=fixtures[tokens.get(noteMatch[1])];if(req.method==='PUT'){let body='';for await(const chunk of req)body+=chunk;report.introduction={...JSON.parse(body),publishedAt:'2026-10-13T10:00:00Z'};writes++;}
  if(req.method==='DELETE'){report.introduction=null;writes++;}
  return res.end(JSON.stringify({introduction:report.introduction??null}));
 }
 if(pathname==='/api/account/me'&&req.headers.authorization==='Bearer '+owner)return res.end(JSON.stringify({displayName:'Fixture',verified:true}));
 res.statusCode=404;res.end('{}');
});
await new Promise(resolve=>api.listen(3101,'127.0.0.1',resolve));
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p','3102','-H','127.0.0.1'],{cwd:root,env:{...process.env,API_BASE:'http://127.0.0.1:3101',ACCOUNT_ORIGIN:'http://localhost:3102'},stdio:'pipe',windowsHide:true});
let diagnostics='';server.stderr.on('data',c=>diagnostics+=c);server.stdout.on('data',()=>{});
const output='outputs/ui-review/prospect';fs.mkdirSync(output,{recursive:true});const matrix=[];let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://localhost:3102/robots.txt')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,diagnostics);
 if(process.argv.includes('--serve-only')){console.log('Synthetic preview ready on http://localhost:3102');process.once('SIGINT',()=>{server.kill();api.close();process.exit(0);});await new Promise(()=>{});}
 browser=await chromium.launch({headless:true});
 for(const lang of ['fr','en'])for(const width of [390,768,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>window.addEventListener('argos-report-displayed',()=>{window.__argosReportReviewed=true;}));
  for(const [key,report] of Object.entries(fixtures))for(const view of ['overview','actions','technical']){
   await page.goto('http://localhost:3102'+(lang==='en'?'/en':'')+'/report/'+tokenFor(key)+'?view='+view);await page.evaluate(()=>document.fonts.ready);
   await page.getByRole('button',{name:lang==='fr'?(view==='overview'?'Vue d’ensemble':view==='actions'?'Plan d’action':'Constats techniques'):(view==='overview'?'Overview':view==='actions'?'Action plan':'Technical findings'),exact:true}).waitFor();
   await page.waitForFunction(()=>window.__argosReportReviewed===true);
   await page.waitForFunction(()=>{const button=document.querySelector('main footer button');return button&&getComputedStyle(button).minHeight!=='0px';});
   assert.equal(await page.getByRole('heading',{level:1}).count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),[key,view,lang,width,theme].join(' ')+' overflow');
   assert.equal(await page.getByText(lang==='fr'?'Préparer une introduction':'Prepare an introduction',{exact:true}).count(),0);
   if(key==='limited')assert.ok(await page.getByText(lang==='fr'?/globale est suffisante/:/overall coverage is sufficient/).count());
   if(key==='unavailable')assert.equal(await page.getByLabel('Score 95/100').count(),0);
   if(view==='technical')assert.equal(await page.locator('details[id^="finding-"]').count(),buildReportModel(report).findings.length);
   if(key==='aggregate'&&view==='actions'){
    const link=page.getByRole('link',{name:lang==='fr'?/Voir le constat: Des styles peu utilisés/:/View finding: Review underused styles/});assert.equal(await link.count(),1);
    await link.click();await page.waitForFunction(()=>document.activeElement?.tagName==='SUMMARY'&&document.activeElement.closest('details')?.open);
   }
   await page.keyboard.press('Tab');assert.ok(await page.locator(':focus').count());
   const cta=await page.locator('main footer').evaluate(footer=>{const group=footer.querySelector('[class*="actions"]');const a=group?.querySelector('a'),b=group?.querySelector('button');return a&&b?{contactHeight:a.getBoundingClientRect().height,shareHeight:b.getBoundingClientRect().height}:null;});
   if(cta)assert.ok(Math.abs(cta.contactHeight-cta.shareHeight)<1,[key,view,lang,width,theme].join(' ')+' CTA heights '+JSON.stringify(cta));
   if(['complete','limited','introduced'].includes(key)&&[390,1280].includes(width)&&theme==='light')await page.screenshot({path:output+'/'+[key,lang,width,view].join('-')+'.png',fullPage:true});
   matrix.push({fixture:key,lang,width,theme,view,overflow:false,oneHeading:true,ownerEditorAbsent:true,cta});
  }
  assert.deepEqual(errors,[]);await context.close();console.log('Verified '+[lang,width,theme].join(' '));
 }
 // Public demonstration still distinguishes HTML title and description in FR/EN on mobile and desktop.
 const context=await browser.newContext();const page=await context.newPage();
 for(const lang of ['fr','en'])for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:3102'+(lang==='en'?'/en/example-report':'/exemple-rapport'));await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.getByText(lang==='fr'?'Le titre de la page est à préciser':'Clarify the page title',{exact:true}).count());
  assert.ok(await page.getByText(lang==='fr'?'La description de la page est à vérifier':'Review the page description',{exact:true}).count());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/example-'+lang+'-'+width+'.png',fullPage:true});
 }
 // Owner preview has no write; explicit publish/revoke modify only the fictional overlay.
 await context.addCookies([{name:'argos_account',value:owner,url:'http://localhost:3102'},{name:'argos_account_csrf',value:'c'.repeat(43),url:'http://localhost:3102'}]);
 await page.goto('http://localhost:3102/report/'+tokenFor('complete'));await page.getByText('Préparer une introduction',{exact:true}).click();
 await page.getByLabel('Identité du prestataire').fill('Atelier conseil fictif');await page.getByLabel('Pourquoi transmettre ce rapport ?').fill('Contexte fictif pour discuter de cette page produit.');await page.getByLabel('Prochaine étape proposée').fill('Examiner les deux preuves ensemble.');
 await page.getByRole('checkbox').nth(0).check();await page.getByRole('checkbox').nth(1).check();await page.getByRole('button',{name:'Prévisualiser la lecture sans connexion'}).click();assert.equal(writes,0);
 await page.screenshot({path:output+'/owner-preview.png',fullPage:true});await page.getByRole('button',{name:'Publier avec le lien du rapport'}).click();await page.getByText('Introduction publiée.',{exact:true}).waitFor();assert.equal(writes,1);
 const anonymous=await browser.newContext();const reader=await anonymous.newPage();await reader.goto('http://localhost:3102/report/'+tokenFor('complete'));await reader.getByRole('region',{name:'Commentaire de votre prestataire'}).waitFor();assert.equal(await reader.getByText('Préparer une introduction',{exact:true}).count(),0);
 const revoked=page.waitForResponse(r=>r.url().includes('/api/account/report-introduction/')&&r.request().method()==='DELETE');await page.getByRole('button',{name:'Retirer l’introduction publiée'}).click();const revokeResponse=await revoked;assert.equal(revokeResponse.status(),200,await revokeResponse.text());await page.getByText('Introduction retirée.',{exact:true}).waitFor();assert.equal(writes,2);
 await reader.reload();assert.equal(await reader.getByRole('region',{name:'Commentaire de votre prestataire'}).count(),0);
 // Eight printable exports, using the same-origin fresh report read, both formats and languages.
 for(const key of ['complete','introduced'])for(const lang of ['fr','en'])for(const format of ['summary','full']){
  await page.goto('http://localhost:3102'+(lang==='en'?'/en':'')+'/report/'+tokenFor(key));await page.getByText(lang==='fr'?'Export et navigation du propriétaire':'Export and owner navigation',{exact:true}).click();
  await page.locator('details').filter({has:page.locator('summary').filter({hasText:lang==='fr'?'Exporter en PDF':'Export PDF'})}).locator('summary').click();
  await page.getByLabel(lang==='fr'?'Format PDF':'PDF format').selectOption(format);const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:lang==='fr'?'Exporter en PDF':'Export PDF',exact:true}).click();const popup=await popupPromise;
  await popup.locator('main').waitFor();await page.getByText(lang==='fr'?'Prévisualisation prête.':'Preview ready.',{exact:false}).waitFor();await popup.evaluate(()=>document.fonts.ready);
  const html=await popup.content();assert.ok(!html.includes(tokenFor(key)));assert.ok(!html.includes('token=private'));assert.ok(!html.includes('user:private'));
  assert.equal(await popup.locator('[id^="finding-"]').count(),format==='full'?buildReportModel(fixtures[key]).findings.length:0);
  if(key==='introduced')assert.ok(html.includes('Cette note humaine'));
  await popup.emulateMedia({media:'print'});await popup.pdf({path:output+'/'+[key,lang,format].join('-')+'.pdf',format:'A4',preferCSSPageSize:true,tagged:true});await popup.close();
 }
 fs.writeFileSync(output+'/matrix.json',JSON.stringify(matrix,null,2)+'\n');console.log(matrix.length+' responsive cases, public examples, owner preview/publication/revocation and 8 PDF exports passed.');
 await context.close();await anonymous.close();
 if(process.argv.includes('--keep-preview')){
  console.log('Human review preview: http://localhost:3102/report/'+tokenFor('introduced'));
  process.once('SIGINT',()=>{server.kill();api.close();process.exit(0);});
  await new Promise(()=>{});
 }
}finally{await browser?.close();server.kill();await new Promise(resolve=>api.close(resolve));}
