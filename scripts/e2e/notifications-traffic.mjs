import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
const base=process.env.HEADER_BASE_URL??'http://localhost:3042';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Fictional local preview only');
const output='outputs/ui-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch();const evidence=[];
try {
 for(const width of [320,390,768,1280])for(const lang of ['fr','en'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
  await context.addCookies(['argos_account','argos_product_consent','argos_traffic_consent_v1'].map(name=>({name,value:name==='argos_account'?'synthetic-review-session':'refused',url:base,httpOnly:true,secure:false})));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const prefix=lang==='en'?'/en':'';
  await page.goto(base+prefix+'/account/admin/analytics/traffic');
  await page.getByText('480',{exact:true}).first().waitFor();
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,`${width} traffic overflow`);
  await page.getByLabel(lang==='fr'?'Regrouper par':'Group by').selectOption('month');
  await page.getByText('480',{exact:true}).first().waitFor();
  await page.screenshot({path:`${output}/traffic-${width}-${lang}-${theme}.png`,fullPage:true});
  const bell=page.getByRole('button',{name:/Notifications/});await bell.click();
  const panel=page.getByRole('region',{name:'Notifications'});await panel.getByRole('link',{name:/atelier.example/}).first().waitFor();
  assert.equal(await panel.getByRole('button',{name:lang==='fr'?'Marquer comme lu':'Mark as read',exact:true}).count(),2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,`${width} inbox overflow`);
  await page.screenshot({path:`${output}/notifications-${width}-${lang}-${theme}.png`,fullPage:true});
  await page.keyboard.press('Escape');await bell.waitFor();assert.equal(await bell.getAttribute('aria-expanded'),'false');assert.equal(await bell.evaluate(e=>e===document.activeElement),true);
  await page.goto(base+prefix+'/account/domains/new');
  const host=page.getByPlaceholder(lang==='fr'?'www.exemple.fr':'www.example.com');await host.waitFor();assert.equal(await host.inputValue(),'');
  assert.ok(await host.evaluate(e=>!!e.closest('label')));await page.screenshot({path:`${output}/domain-placeholder-${width}-${lang}-${theme}.png`,fullPage:true});
  assert.deepEqual(errors,[]);evidence.push({width,lang,theme,traffic:true,inbox:true,domainInput:true,errors});await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 await page.goto(base+'/');await page.getByRole('button',{name:'Personnaliser'}).click();
 assert.equal(await page.getByRole('checkbox',{name:'Mesure de fréquentation'}).isChecked(),false);assert.equal(await page.getByRole('checkbox',{name:'Mesure produit'}).isChecked(),false);
 await page.screenshot({path:`${output}/consent-custom-mobile.png`,fullPage:false});
 await page.getByRole('button',{name:'Tout refuser / retirer'}).click();await page.getByRole('button',{name:'Gérer mes cookies'}).waitFor();
 const cookies=await context.cookies();assert.equal(cookies.find(c=>c.name==='argos_traffic_consent_v1')?.value,'refused');assert.equal(cookies.some(c=>c.name==='argos_traffic_visit'),false);
 await context.close();
 await writeFile(`${output}/notifications-traffic.json`,JSON.stringify({fictionalData:true,evidence,consentRefusal:true},null,2));
 console.log(`Verified ${evidence.length} responsive/language/theme combinations plus granular consent/refusal.`);
} finally {await browser.close();}
