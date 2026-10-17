import { injectAxe } from './inject-axe.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import {response} from './connected-analysis-fixture.mjs';
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3030';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output='outputs/ui-review/clarte-evidence';await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.CLARTE_BROWSER_PATH?{executablePath:process.env.CLARTE_BROWSER_PATH}:{});
const results=[];
// Canonical finding anchors are shared by both report readers; metadata markup may differ.
const findingAnchor=key=>'finding-'+Array.from(key).map(char=>char.codePointAt(0).toString(16)).join('-');
try {
 for(const width of [390,1056]) for(const lang of ['fr','en']) for(const colorScheme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme});
  const page=await context.newPage(), errors=[];let state='available';page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/account/**',async route=>{
   const url=new URL(route.request().url());let data=response(url.pathname,url.searchParams);
   if(url.pathname.endsWith('/runs/43/report')) {
    data.issues=[{id:'runtime.network.5xx',categoryKey:'performance',module:'runtime',severity:'critical',title:'HTTP 5xx responses',impact:'Observed server error',recommendation:'Inspect server logs',confidence:'HIGH',
      structuredEvidence:{source:'runtime',measurement:{value:12,unit:'count'},observed:{version:'observed-evidence-v1',source:'runtime',state:state==='unavailable'?'UNAVAILABLE':'AVAILABLE',inspected:12,truncated:state==='truncated',redacted:true,
      items:state==='unavailable'?[]:Array.from({length:state==='truncated'?10:1},(_,i)=>({kind:'resource',origin:'https://observed-resource-with-a-long-name.cdn.example',resourceRef:String(i).padStart(16,'a'),status:503,ownership:i%2?'THIRD_PARTY':'FIRST_PARTY'}))}}},
     {id:'lighthouse.audit.image-alt',categoryKey:'a11y',module:'lighthouse',severity:'critical',title:'Image alternative',impact:'Observed missing alt',recommendation:'Inspect the element',confidence:'HIGH',
      structuredEvidence:{source:'lighthouse',observed:{version:'observed-evidence-v1',source:'lighthouse',state:'AVAILABLE',inspected:4,truncated:false,redacted:true,items:[{kind:'element',nodePath:'1,HTML,1,BODY,2,MAIN,4,IMG'}]}}}];
    data.summary.priorities=[];
    if(state==='historical') for(const issue of data.issues) delete issue.structuredEvidence.observed;
   }
   await route.fulfill({status:data?200:404,contentType:'application/json',body:JSON.stringify(data??{error:'resource_unavailable'})});
  });
  for(state of ['available','truncated','unavailable','historical']) {
   await page.goto(base+(lang==='en'?'/en':'')+'/account/runs/43?view=technical');
   const details=page.locator('details#'+findingAnchor('runtime.network.5xx'));
   const summary=details.locator('summary').first();await summary.waitFor();
   if(await details.evaluate(el=>el.open)) {await summary.focus();await page.keyboard.press('Enter');}
   await summary.focus();await page.keyboard.press('Enter');
   assert.ok(await details.evaluate(el=>el.open));
   if(state==='historical') assert.equal(await page.locator('[data-observed-evidence]').count(),0);
   else {
    const block=details.locator('[data-observed-evidence]');await block.waitFor();
    assert.equal(await block.locator('li').count(),state==='truncated'?10:state==='unavailable'?0:1);
    assert.ok((await block.textContent()).includes(state==='unavailable'?(lang==='fr'?'Cela ne signifie pas':'This does not mean'):(lang==='fr'?'Origine de la ressource':'Resource origin')));
    assert.equal(await block.locator('a').count(),0);
   }
   assert.equal(await page.locator('h1').count(),1);assert.equal(await page.getByRole('contentinfo').count(),1);
   await page.evaluate(()=>document.fonts.ready);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await injectAxe(page);
   const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('[data-connected-shell]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id));
   assert.deepEqual(violations,[]);
   await page.screenshot({path:`${output}/${state}-${lang}-${colorScheme}-${width}.png`,fullPage:true});
   results.push({state,lang,theme:colorScheme,width,overflow:false,axeViolations:0,keyboard:true});
   if(state==='available') {
    const dom=page.locator('details#'+findingAnchor('lighthouse.audit.image-alt'));
    const domSummary=dom.locator('summary').first();await domSummary.focus();await page.keyboard.press('Enter');
    assert.ok(await dom.evaluate(el=>el.open));
    assert.ok((await dom.locator('[data-observed-evidence]').textContent()).includes('1,HTML,1,BODY,2,MAIN,4,IMG'));
    await dom.locator('[data-observed-evidence]').screenshot({path:`${output}/dom-${lang}-${colorScheme}-${width}.png`});
    if(width===390 && lang==='en' && colorScheme==='dark') for(const edge of [320,768]) {
      await page.setViewportSize({width:edge,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await details.locator('[data-observed-evidence]').screenshot({path:`${output}/resource-en-dark-${edge}.png`});
    }
    await page.setViewportSize({width,height:900});
   }
   await summary.focus();await page.keyboard.press('Enter');assert.equal(await details.evaluate(el=>el.open),false);
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(output+'/results.json',JSON.stringify(results,null,2));console.log(results.length+' observed evidence visual/accessibility cases passed');
}finally{await browser.close();}
