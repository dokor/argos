// Compare the real production reader with the approved, sandboxed visualization.
// Start report-fidelity-fixture.mjs, Next on 3040 and the visualization renderer on 3041.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
const output='outputs/ui-review/report-fidelity';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch(),results=[];
try {
 for(const width of [320,390,768,1120]) for(const theme of ['light','dark']) for(const lang of ['fr','en']) for(const mode of ['visitor','owner','shared','shared-connected']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme});
  if(mode==='owner'||mode==='shared-connected')await context.addCookies([{name:'argos_account',value:'synthetic-visual-session',url:'http://localhost:3040'}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const route=mode==='owner'?'/account/runs/644':mode.startsWith('shared')?'/share/'+'s'.repeat(43):'/report/fidelity-complete-fixture';
  await page.goto('http://localhost:3040'+(lang==='en'?'/en':'')+route);
  await page.getByRole('heading',{name:'atelier.example',level:1}).waitFor();
  if(mode==='shared-connected')await page.getByRole('link',{name:lang==='fr'?'Mon compte':'My account',exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const main=page.locator('main').filter({has:page.getByRole('heading',{name:'atelier.example',level:1})}).last();
  assert.equal(await page.getByRole('term').count(),13);
  assert.equal(await page.getByRole('heading',{level:1}).count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),mode+' '+width+' overflow');
  const name=[mode,lang,width,theme].join('-');
  await main.screenshot({path:output+'/'+name+'.png'});
  const bounds=await main.boundingBox();
  if(lang==='fr'&&[390,1120].includes(width)&&mode!=='shared-connected'){
   const refContext=await browser.newContext({viewport:{width:width+32,height:1000},colorScheme:theme});
   const reference=await refContext.newPage();await reference.goto('http://127.0.0.1:3041/');
   const frame=reference.frames().find(f=>f.url()==='about:srcdoc');assert.ok(frame);
   await frame.waitForSelector('.ar-app[data-mode="visitor"] h1');
   // Select the existing carousel variant; do not alter its layout, copy or data.
   await frame.evaluate(mode=>document.querySelectorAll('[data-variant]').forEach(section=>section.hidden=section.querySelector('.ar-app').dataset.mode!==mode),mode);
   const body=frame.locator('.ar-app[data-mode="'+mode+'"] .ar-body');
   const initial=await body.boundingBox();await reference.setViewportSize({width:Math.round(width+32+bounds.width-initial.width),height:1000});
   await frame.evaluate(()=>document.fonts.ready);
   const referenceBounds=await body.boundingBox();assert.ok(Math.abs(referenceBounds.width-bounds.width)<2,'Identical report widths');
   await body.screenshot({path:output+'/reference-'+name+'.png'});
   await refContext.close();
  }
  await page.getByRole('button',{name:lang==='fr'?'Constats techniques':'Technical findings',exact:true}).click();
  if(mode==='owner'||mode==='shared-connected')assert.ok(await page.locator('details[id^="finding-"]').count()>0);
  else assert.equal(await page.getByRole('link',{name:lang==='fr'?'Créer mon compte':'Create my account',exact:true}).count(),1);
  await page.getByRole('button',{name:lang==='fr'?'Vue d’ensemble':'Overview',exact:true}).click();
  await page.locator('summary').filter({hasText:lang==='fr'?'Exporter en PDF':'Export PDF'}).click();
  await page.getByLabel(lang==='fr'?'Format PDF':'PDF format').waitFor({state:'visible'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Export panel overflow');
  if(mode==='owner'){
   await page.locator('summary').filter({hasText:lang==='fr'?'Partager ce rapport':'Share this report'}).click();
   await page.getByLabel(lang==='fr'?'Validité du lien':'Link validity').waitFor({state:'visible'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Share panel overflow');
  }
  assert.deepEqual(errors,[]);
  results.push({mode,lang,width,theme,reportWidth:bounds.width,reportHeight:bounds.height,overflow:false,errors:0});
  await context.close();
 }
 fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2)+'\n');
 console.log(results.length+' real reader cases passed; approved reference captures at matched report widths.');
}finally{await browser.close();}
