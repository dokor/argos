// Run the read-only report-fidelity fixture on 3018 and Next with API_BASE on 3040.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : '../../apps/playwright-service/node_modules/playwright/index.mjs');
const base=process.env.REPORT_REVIEW_BASE??'http://localhost:3040';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local fixtures only');
const output='outputs/ui-review/issues-668-669-675';await mkdir(output,{recursive:true});
// Keep fixed public navigation and development overlays out of section captures.
const captureStyle='nav[data-menu-open] { visibility: hidden } nextjs-portal { visibility: hidden }';
const browser=await chromium.launch(process.env.REVIEW_BROWSER_CHANNEL?{channel:process.env.REVIEW_BROWSER_CHANNEL}:{}),results=[];
try {
 for(const width of [320,360,390,768,1120]) for(const theme of ['light','dark']) for(const lang of ['fr','en']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const prefix=lang==='en'?'/en':'';
  await page.goto(base+(lang==='fr'?'/methodologie-score':'/en/scoring-method'));
  const example=page.locator('#exemple'),cards=example.getByRole('region'),table=example.getByRole('table');
  if(width<=800) {
   await cards.waitFor();assert.equal(await cards.getByRole('article').count(),4);
   assert.equal(await table.count(),0,'Only the mobile representation is exposed');
   assert.equal(await cards.getByRole('definition').count(),12);
  } else {assert.equal(await table.count(),1);assert.equal(await cards.count(),0);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Methodology overflow '+width);
  if([320,390,1120].includes(width))await example.screenshot({path:`${output}/after-example-${lang}-${width}-${theme}.png`,style:captureStyle});
  if(width===768){
   await page.locator('main').evaluate(el=>el.style.zoom='2');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% enlarged text overflow');
   await example.screenshot({path:`${output}/after-example-${lang}-200-percent-${theme}.png`,style:captureStyle});
  }
  await context.addCookies([{name:'argos_account',value:'synthetic-visual-session',url:base}]);
  await page.goto(base+prefix+'/account/runs/644');
  await page.getByRole('heading',{name:'atelier.example',level:1}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'atelier.example',level:1}).waitFor();
  const breadcrumb=page.getByRole('navigation',{name:lang==='fr'?'Fil d’Ariane':'Breadcrumb'}),link=breadcrumb.getByRole('link');
  assert.equal(await link.getAttribute('href'),prefix+'/account/sites');
  assert.equal(await breadcrumb.locator('[aria-current="page"]').innerText(),lang==='fr'?'Rapport enregistré':'Saved report');
  await link.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
  assert.ok(await link.evaluate(el=>el===document.activeElement&&getComputedStyle(el).outlineStyle!=='none'),'Visible keyboard focus');
  const footer=page.locator('footer').filter({has:page.locator('nav')});
  assert.equal(await footer.getByRole('link').count(),5);assert.equal(await footer.getByText('Argos',{exact:true}).count(),0);
  const contact=footer.getByRole('link',{name:lang==='fr'?'Nous contacter':'Contact us'});
  assert.equal(await contact.getAttribute('href'),prefix+'/feedback');
  if(width===1120){const linksBox=await footer.locator('nav').boundingBox(),contactBox=await contact.boundingBox();assert.ok(contactBox.x>linksBox.x+linksBox.width);assert.ok(Math.abs(contactBox.y-linksBox.y)<2);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Private report overflow '+width);
  if([320,390,1120].includes(width)){
   await breadcrumb.screenshot({path:`${output}/after-breadcrumb-${lang}-${width}-${theme}.png`});
   await footer.screenshot({path:`${output}/after-footer-${lang}-${width}-${theme}.png`});
  }
  // Follow the real link from a direct arrival and reload, never history.back().
  await link.press('Enter');await page.waitForURL(base+prefix+'/account/sites');
  assert.deepEqual(errors,[]);
  results.push({width,theme,lang,directArrivalAndReload:true,keyboardNavigation:true,overflow:false});
  await context.close();
 }
 // Public and shared readers must not gain private parent navigation.
 for(const path of ['/report/fidelity-complete-fixture','/share/'+'s'.repeat(43)]){
  const page=await browser.newPage();await page.goto(base+path);await page.getByRole('heading',{name:'atelier.example',level:1}).waitFor();
  assert.equal(await page.getByRole('navigation',{name:'Fil d’Ariane'}).count(),0);await page.close();
 }
 await writeFile(output+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(`${results.length} viewport/language/theme combinations passed, plus public/shared boundaries.`);
} finally {await browser.close();}
