import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
const root=path.resolve('apps/console-web');const require=createRequire(path.join(root,'package.json'));const ts=require('typescript');
const source=fs.readFileSync(path.join(root,'src/components/marketing/reportDemoFixture.ts'),'utf8');
const {demoReport}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const build=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build'],{cwd:root,env:{...process.env,API_BASE:'http://127.0.0.1:3091'},stdio:'pipe',windowsHide:true});let buildOutput='';build.stdout.on('data',c=>buildOutput+=c);build.stderr.on('data',c=>buildOutput+=c);assert.equal(await new Promise(resolve=>build.on('exit',resolve)),0,buildOutput);
const historical=JSON.parse(fs.readFileSync(path.join(root,'src/components/report/fixtures/historical-report.json'),'utf8'));
const fixtures={complete:demoReport('fr'),partial:demoReport('fr',true),historical,empty:{...demoReport('fr'),issues:[],summary:{oneLiner:'good',priorities:[]}}};
fixtures.complete.issues.push({id:'runtime.console.errors',categoryKey:'performance',module:'runtime',severity:'critical',title:'Élément technique très long '.repeat(18),impact:'Observation fictive',recommendation:'Contrôler',evidence:('Évidence avec accents et texte long, sans donnée réelle.\n').repeat(50),confidence:'LOW'});
fixtures.complete.summary.priorities[0].relatedFindingKeys=[fixtures.complete.issues[0].id,fixtures.complete.issues[1].id,fixtures.complete.issues[1].id,'missing-fixture'];
const webOnly=process.argv.includes('--web');
if(webOnly){ fixtures.antibot={...demoReport('fr',true),antiBot:{detected:true,vendor:'fixture'}};fixtures.unavailable=demoReport('fr',true);fixtures.unavailable.scores.globalAvailable=false;fixtures.unavailable.scores.coverage.global.available=false;fixtures.unavailable.scores.coverage.domains.forEach(d=>d.available=false); }
const reads=new Map();
const api=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');const key=req.url.split('/')[3]?.replace('fixture-','');if(key==='expiring'){const count=(reads.get(key)||0)+1;reads.set(key,count);if(count===1)return res.end(JSON.stringify(fixtures.complete));}else if(fixtures[key]&&!req.url.endsWith('/status'))return res.end(JSON.stringify(fixtures[key]));res.statusCode=404;res.end('{}');});
await new Promise(resolve=>api.listen(3091,'127.0.0.1',resolve));
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p','3090'],{cwd:root,env:{...process.env,API_BASE:'http://127.0.0.1:3091'},stdio:'pipe',windowsHide:true});let diagnostics='';server.stderr.on('data',c=>diagnostics+=c);server.stdout.on('data',()=>{});
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://localhost:3090/robots.txt');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,diagnostics);
 browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();const output='output/pdf/report-fixtures';fs.mkdirSync(output,{recursive:true});const rows=[];

 if(webOnly){
  const directory='outputs/report-validation';fs.mkdirSync(directory,{recursive:true});const checks=[];
  for(const lang of ['fr','en'])for(const [fixture,report] of Object.entries(fixtures))for(const width of [360,768,1024,1440])for(const theme of ['light','dark']){
   const viewContext=await browser.newContext({viewport:{width,height:900},colorScheme:theme});const viewPage=await viewContext.newPage();const errors=[];viewPage.on('pageerror',e=>errors.push(e.message));
   for(const view of ['overview','actions','technical']){
    await viewPage.goto('http://localhost:3090'+(lang==='en'?'/en':'')+'/report/fixture-'+fixture+'?view='+view);await viewPage.evaluate(()=>document.fonts.ready);
    await viewPage.getByRole('button',{name:lang==='fr'?(view==='overview'?'Vue d’ensemble':view==='actions'?'Plan d’action':'Constats techniques'):(view==='overview'?'Overview':view==='actions'?'Action plan':'Technical findings'),exact:true}).waitFor();
    await viewPage.waitForTimeout(50);assert.equal(await viewPage.getByRole('heading',{level:1}).count(),1,fixture+' '+view+' '+JSON.stringify(await viewPage.locator('h1').allTextContents())+' '+JSON.stringify(errors));
    assert.ok(await viewPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),fixture+' '+view+' '+width+' overflow');
    if(view==='technical')assert.equal(await viewPage.locator('details[id^="finding-"]').count(),new Set(report.issues.map((f,i)=>f.id||'legacy'+i)).size);
    const contrast=await viewPage.evaluate(()=>{
 const rgba=s=>{const n=s.match(/[\d.]+/g)?.map(Number)??[0,0,0,0];return [n[0],n[1],n[2],n[3]??1];};
 const blend=(top,bottom)=>top.slice(0,3).map((x,i)=>x*top[3]+bottom[i]*(1-top[3]));
 const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[0.2126,0.7152,0.0722][i],0);
 const fails=[];let tested=0;
 for(const element of document.querySelectorAll('header *,main *,footer *')){
  if(!(element instanceof HTMLElement)||element.closest('button:disabled')||!element.getClientRects().length||!Array.from(element.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim()))continue;
  const style=getComputedStyle(element);if(style.visibility==='hidden')continue;
  const chain=[];for(let node=element;node;node=node.parentElement)chain.unshift(node);
  let background=[255,255,255];for(const node of chain)background=blend(rgba(getComputedStyle(node).backgroundColor),background);
  const foreground=blend(rgba(style.color),background);const a=luminance(foreground),b=luminance(background);const ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);const threshold=large?3:4.5;tested++;
  if(ratio<threshold)fails.push({text:element.textContent?.slice(0,60),class:element.className,color:style.color,background,ratio:Math.round(ratio*100)/100,threshold});
 }
 return {tested,fails};
});
    await viewPage.keyboard.press('Tab');assert.ok(await viewPage.locator(':focus').count());
    await viewPage.screenshot({path:directory+'/'+[fixture,lang,width,theme,view].join('-')+'.png',fullPage:true});
    await viewPage.setViewportSize({width:Math.floor(width/2),height:450});if(!await viewPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)){console.log(await viewPage.locator('*').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width>0).slice(0,12).map(e=>({tag:e.tagName,class:e.className,text:e.textContent?.slice(0,80),right:e.getBoundingClientRect().right}))));throw new Error(fixture+' '+view+' reflow');}await viewPage.setViewportSize({width,height:900});
    checks.push({fixture,lang,width,theme,view,reflow200:true,unique:true,contrastTests:contrast.tested,contrastFailures:contrast.fails});
   }
   assert.deepEqual(errors,[]);await viewContext.close();
   if(width===1440&&theme==='dark')console.log('Validated report views: '+fixture+' '+lang);
  }
  fs.writeFileSync('docs/testing/report/web-matrix.json',JSON.stringify(checks,null,2)+'\n');
  for(const lang of ['fr','en']){
   const prefix=lang==='en'?'/en':'';await page.goto('http://localhost:3090'+prefix+'/report/fixture-historical?view=actions');
   await page.getByRole('link',{name:(lang==='fr'?'Voir le constat':'View finding')+': Load resources',exact:true}).click();
   await page.waitForFunction(()=>document.activeElement?.tagName==='SUMMARY'&&document.activeElement.closest('details')?.open);
   assert.ok(page.url().includes('view=technical'));await page.goBack();await page.waitForURL(url=>url.searchParams.get('view')==='actions');await page.locator('#report-actions').waitFor();await page.goForward();await page.waitForURL(url=>url.searchParams.get('view')==='technical');await page.locator('#report-technical').waitFor();
   await page.getByLabel(lang==='fr'?'Domaine':'Domain',{exact:true}).selectOption('seo');await page.getByRole('button',{name:lang==='fr'?'Critiques':'Critical',exact:true}).click();
   await page.getByRole('button',{name:lang==='fr'?'Afficher tous les constats':'Show all findings',exact:true}).click();assert.ok(!page.url().includes('domain='));
  }
  fs.writeFileSync('docs/testing/report/web-matrix.json',JSON.stringify(checks,null,2)+'\n');const failures=checks.filter(r=>r.contrastFailures.length);console.log(failures.slice(0,15));assert.equal(failures.length,0,'Text contrast');console.log(checks.length+' report view/layout/keyboard/reflow cases passed.');
 }else{
 for(const lang of ['fr','en'])for(const [fixture,report] of Object.entries(fixtures))for(const format of ['summary','full']){
  await page.goto('http://localhost:3090'+(lang==='en'?'/en':'')+'/report/fixture-'+fixture+'?view=technical&domain=security&severity=critical');
  await page.getByLabel(lang==='fr'?'Format PDF':'PDF format').selectOption(format);
  const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:lang==='fr'?'Exporter en PDF':'Export PDF',exact:true}).click();const popup=await popupPromise;
  await popup.locator('main').waitFor();await page.getByText(lang==='fr'?'Prévisualisation prête.':'Preview ready.',{exact:false}).waitFor();await popup.evaluate(()=>document.fonts.ready);
  assert.equal(popup.url(),'about:blank');assert.match(await popup.title(),/^Argos-(full|summary)-/);assert.ok(!(await popup.content()).includes('/report/fixture-'));
  const count=await popup.locator('[id^="finding-"]').count();assert.equal(count,format==='full'?new Set(report.issues.map((f,i)=>f.id||'legacy'+i)).size:0);
  const name=[fixture,lang,format].join('-');await popup.emulateMedia({media:'print'});await popup.pdf({path:output+'/'+name+'.pdf',format:'A4',preferCSSPageSize:true,printBackground:false,tagged:true});
  await popup.screenshot({path:output+'/'+name+'.png',fullPage:true});rows.push({fixture,lang,format,findings:count,title:await popup.title(),url:'about:blank'});await popup.close();
 }
 await page.goto('http://localhost:3090/report/fixture-expiring');await page.getByRole('button',{name:'Exporter en PDF',exact:true}).click();await page.getByText('Export impossible',{exact:false}).waitFor();
 fs.mkdirSync('docs/testing/report',{recursive:true});fs.writeFileSync('docs/testing/report/pdf-contract.json',JSON.stringify(rows,null,2)+'\n');console.log('16 PDF fixtures exported; same-origin access, expiration, formats, unique counts and token-free previews verified.');
 }
}finally{await browser?.close();server.kill();await new Promise(resolve=>api.close(resolve));}
