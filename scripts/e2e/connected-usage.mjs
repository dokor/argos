import { injectAxe } from './inject-axe.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import {response,usage,items} from './connected-usage-fixture.mjs';
import fr from '../../apps/console-web/src/lib/i18n/fr.json' with {type:'json'};
import en from '../../apps/console-web/src/lib/i18n/en.json' with {type:'json'};
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3030';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output='outputs/ui-review/clarte-usage';await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.CLARTE_BROWSER_PATH?{executablePath:process.env.CLARTE_BROWSER_PATH}:{}),evidence=[];
try{
 for(const width of [320,390,768,1056,1440])for(const lang of ['fr','en'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme}),page=await context.newPage();let mode='normal';const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/account/**',async route=>{
   const url=new URL(route.request().url());let data=response(url.pathname,url.searchParams),status=200;
   if(url.pathname.endsWith('/usage')){
    if(mode==='zero')data={...usage,limit:0,available:0,canLaunch:false};
    if(mode==='unlimited')data={...usage,limit:null,available:null};
    if(mode==='exhausted')data={...usage,used:20,reserved:0,available:0,canLaunch:false};
    if(mode==='quota-error'){status=503;data={error:'account_unavailable'};}
   }
   if(url.pathname.endsWith('/usage/events')&&mode==='ledger-error'){status=503;data={error:'account_unavailable'};}
   if(mode==='pending'&&url.pathname.endsWith('/me'))data={...data,verified:false};
   if(mode==='expired'&&url.pathname.endsWith('/me')){status=401;data={error:'session_invalid'};}
   if(!data){status=404;data={error:'resource_unavailable'};}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  const prefix=lang==='en'?'/en':'',labels=lang==='fr'?{monthly:'Mon quota mensuel',open:'Voir l’analyse',month:'Mois du journal',show:'Afficher',next:'Suivant',current:'Mois courant',empty:'Aucune opération pour ce mois',retry:'Réessayer'}:{monthly:'My monthly quota',open:'View analysis',month:'Ledger month',show:'Show',next:'Next',current:'Current month',empty:'No operations for this month',retry:'Try again'};
  async function visit(query=''){await page.goto(base+prefix+'/account/usage'+query);await page.locator('h1').waitFor();}
  async function check(name){
   await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('h1').count(),1,name);assert.equal(await page.locator('footer').count(),1,name);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),name+': overflow');
   await injectAxe(page);
   const violations=await page.evaluate(async()=> (await window.axe.run(document.querySelector('[data-connected-shell]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
   assert.deepEqual(violations,[],name);const file=`${name}-${lang}-${theme}-${width}.png`;await page.screenshot({path:`${output}/${file}`,fullPage:true});evidence.push({name,lang,theme,width,screenshot:file,axeViolations:0,overflow:false});
  }
  const runLink=id=>page.locator(`main a[href="${prefix}/account/runs/${id}"]`);
  await visit();await runLink(items[0].runId).waitFor();
  assert.equal(await runLink(items[0].runId).getAttribute('title'),items[0].url,'The compact URL retains its complete destination');
  assert.ok((await runLink(items[0].runId).innerText()).includes('atelier.example/collection/'),'The ledger identifies the analyzed page');
  const identifiers=runLink(items[0].runId).locator('..').locator('details');
  assert.equal(await identifiers.getAttribute('open'),null,'Technical identifiers start collapsed');
  await identifiers.locator('summary').click();
  assert.ok((await identifiers.innerText()).includes('#'+items[0].runId),'Exact run identifier stays available without numeric truncation');
  assert.ok((await identifiers.innerText()).includes('#'+items[0].batchId),'Exact batch identifier stays available');
  await identifiers.locator('summary').click();await check('current');
  const meter=page.getByRole('meter',{name:(lang==='fr'?fr:en).usagePage.available,exact:true});
  await meter.waitFor();
  assert.equal(await meter.getAttribute('value'),String(usage.available),'The gauge represents the remaining credits supplied by the server');
  assert.equal(await meter.getAttribute('max'),String(usage.limit));
  await page.getByRole('button',{name:labels.current,exact:true}).focus();await page.keyboard.press('Tab');
  const displayedMonth=new Intl.DateTimeFormat(lang,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(usage.period+'-01T00:00:00Z'));
  const ledgerRegion=page.getByRole('region',{name:(lang==='fr'?'Journal de consommation':'Usage ledger')+' · '+displayedMonth});
  assert.ok(await ledgerRegion.evaluate(el=>el===document.activeElement),'Keyboard reaches ledger region');
  if(width<768){await page.keyboard.press('ArrowRight');await page.waitForFunction(element=>element.scrollLeft>0,await ledgerRegion.elementHandle());}

  await page.getByRole('button',{name:labels.next,exact:true}).click();await page.waitForURL(/offset=20/);await runLink('2020').waitFor();assert.equal(await page.getByRole('table').locator('tbody tr').count(),4);await check('page-two');
  const languageLink=page.getByRole('link',{name:lang==='fr'?'English':'Français',exact:true});assert.ok((await languageLink.getAttribute('href')).includes('offset=20'));
  await page.getByLabel(labels.month).fill('2026-09');await page.getByRole('button',{name:labels.show,exact:true}).click();await page.waitForURL(/period=2026-09$/);assert.ok(!new URL(page.url()).searchParams.has('offset'));await runLink('2010').waitFor();await check('prior-month');
  assert.equal(await page.getByRole('link',{name:`${usage.available} ${(lang==='fr'?fr:en).connected.credits}`,exact:true}).count(),1,'Historic filter never changes current quota');
  await page.getByLabel(labels.month).fill('2026-08');await page.getByRole('button',{name:labels.show,exact:true}).click();await page.getByRole('heading',{name:labels.empty}).waitFor();await check('empty');
  if([320,1440].includes(width)){
   for(const variant of ['zero','unlimited','exhausted','quota-error','ledger-error']){
    mode=variant;await visit();
    if(variant==='ledger-error'){await page.locator('main').getByRole('alert').waitFor();}
    else {await runLink(items[0].runId).waitFor();}
    await check(variant);
    if(variant==='ledger-error'){mode='normal';await page.getByRole('button',{name:labels.retry,exact:true}).click();await page.getByRole('table').waitFor();}
   }
   mode='normal';await visit('?period=2026-13&offset=-1');await page.locator('main').getByRole('heading',{name:lang==='fr'?'Les filtres du journal sont invalides.':'The ledger filters are invalid.'}).waitFor();await check('invalid-filter');
   await visit('?period=2026-10&offset=100');await page.getByRole('heading',{name:lang==='fr'?'Aucune opération sur cette page':'No operations on this page'}).waitFor();await check('out-of-range');
   await visit();await page.getByRole('table').waitFor();await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await check('text-200');
   for(const variant of ['pending','expired']){mode=variant;await visit();await page.getByRole('heading',{name:variant==='pending'?(lang==='fr'?'Vérification de l’adresse requise':'Email verification required'):(lang==='fr'?'Connectez-vous à votre espace':'Sign in to your workspace')}).waitFor();assert.equal(await page.locator('tbody tr').count(),0);await check(variant);}
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(`${output}/results.json`,JSON.stringify({browser:browser.version(),fixtures:'Synthetic transport responses; MariaDB lifecycle/concurrency covered in UsageIT and AccountLifecycleIT.',checks:evidence},null,2));console.log(`${evidence.length} Clarte usage scenarios passed`);
}finally{await browser.close();}
