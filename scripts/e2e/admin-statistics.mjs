import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import { fixture } from './connected-admin-fixture.mjs';

const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3030';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output='outputs/ui-review/admin-statistics';
await mkdir(output,{recursive:true});
const metrics={
 generatedAt:'2026-10-17T10:00:00Z',from:null,period:'all',
 accounts:{created:1250,validated:900,suspended:12,archived:48,validationUnknown:48,google:610,github:300,linkedin:120},
 analyses:{total:2430,completed:2100,failed:130,running:20,queued:80,canceled:70,unknown:30},
 domains:{total:810,averageUrls:3},
};
const browser=await chromium.launch(),evidence=[];
let lastPage;
try {
 for(const width of [320,390,768,1440]) for(const lang of ['fr','en']) for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
  const page=await context.newPage(),f=fixture(),errors=[],requests=[];
  lastPage=page;let mode='data';
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/account/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/api/account/admin/statistics') {
    requests.push(url.searchParams.get('period'));
    if(mode==='loading') await new Promise(resolve=>setTimeout(resolve,500));
    const empty=structuredClone(metrics);
    for(const group of ['accounts','analyses','domains'])for(const key of Object.keys(empty[group]))empty[group][key]=0;
    const data=mode==='empty'?empty:structuredClone(metrics);
    if(mode==='unavailable')data.accounts.linkedin=null;
    const period=url.searchParams.get('period');data.period=period;
    data.from=period==='all'?null:new Date(Date.parse(data.generatedAt)-Number(period)*86400000).toISOString();
    await route.fulfill({status:mode==='error'?503:mode==='denied'?403:200,contentType:'application/json',
     body:JSON.stringify(mode==='error'||mode==='denied'?{error:mode==='error'?'unavailable':'admin_required'}:data)});
   } else {
    const result=f.respond(url.pathname,url.searchParams,req.method(),req.postDataJSON());
    await route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.data)});
   }
  });
  const prefix=lang==='en'?'/en':'',refresh=lang==='fr'?'Actualiser':'Refresh';
  const capture=async name=>{
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('h1').count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow at '+width);
   await page.addScriptTag({path:'apps/console-web/node_modules/axe-core/axe.min.js'});
   const axe=await page.evaluate(()=>window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
   assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
   const screenshot=name+'-'+lang+'-'+theme+'-'+width+'.png';
   await page.screenshot({path:output+'/'+screenshot,fullPage:true});
   evidence.push({name,lang,theme,width,screenshot});
  };
  await page.goto(base+prefix+'/account/admin/analytics/overview');
  await page.locator('main dd').filter({hasText:/1[\s,]250/}).waitFor();
  await capture('overview');
  assert.equal(await page.getByRole('link',{name:lang==='fr'?'Mesure produit':'Product measurement',exact:true}).getAttribute('href'),prefix+'/account/admin/analytics');
  await page.getByRole('combobox').selectOption('7');
  await page.locator('main time').nth(1).waitFor();
  assert.equal(requests.at(-1),'7');
  await page.getByRole('button',{name:refresh,exact:true}).click();
  await page.locator('main dd').filter({hasText:/1[\s,]250/}).waitFor();
  const summary=page.locator('main summary');await summary.click();
  assert.equal(await summary.evaluate(el=>el.parentElement.open),true);
  await capture('period-and-definition');
  if(width===390&&lang==='fr'&&theme==='light') {
   for(const state of ['empty','unavailable','error','loading','denied']) {
    mode=state;await page.reload();
    if(state==='loading')await page.locator('main').getByRole('status').filter({hasText:'Chargement des statistiques'}).waitFor();
    else if(state==='error'||state==='denied')await page.locator('main').getByRole('alert').waitFor();
    else if(state==='empty')await page.getByText('Aucune création de compte ni première analyse dans cette période.').waitFor();
    else await page.getByLabel('Indisponible',{exact:true}).waitFor();
    await capture(state);
    if(state==='denied')assert.equal(await page.locator('main dd').count(),0);
   }
  }
  assert.deepEqual(errors,[]);
  await context.close();
 }
 await writeFile(output+'/results.json',JSON.stringify({fixtures:'Synthetic business aggregates. Real SQL and HTTP authorization are tested on MariaDB.',checks:evidence},null,2));
 console.log(evidence.length+' statistics UI checks passed');
} catch(error) {
 if(lastPage)await lastPage.screenshot({path:output+'/failure.png',fullPage:true});
 throw error;
} finally {await browser.close();}
