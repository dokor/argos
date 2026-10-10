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
const reads=new Map();
const api=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');const key=req.url.split('/')[3]?.replace('fixture-','');if(key==='expiring'){const count=(reads.get(key)||0)+1;reads.set(key,count);if(count===1)return res.end(JSON.stringify(fixtures.complete));}else if(fixtures[key]&&!req.url.endsWith('/status'))return res.end(JSON.stringify(fixtures[key]));res.statusCode=404;res.end('{}');});
await new Promise(resolve=>api.listen(3091,'127.0.0.1',resolve));
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p','3090'],{cwd:root,env:{...process.env,API_BASE:'http://127.0.0.1:3091'},stdio:'pipe',windowsHide:true});let diagnostics='';server.stderr.on('data',c=>diagnostics+=c);server.stdout.on('data',()=>{});
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://localhost:3090/robots.txt');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,diagnostics);
 browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();const output='output/pdf/report-fixtures';fs.mkdirSync(output,{recursive:true});const rows=[];
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
}finally{await browser?.close();server.kill();await new Promise(resolve=>api.close(resolve));}
