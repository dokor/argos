import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';

const base=process.env.HISTORY_BASE_URL ?? 'http://127.0.0.1:3119';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local fixture only');
const output='outputs/account-history';await mkdir(output,{recursive:true});
const context={siteId:'7',siteUrlId:'9',normalizedUrl:'https://example.com/products/a-long-path?category=accessories'};
const item=(id,score,reason)=>({runId:String(id),status:'COMPLETED',createdAt:`2026-10-${String(id+1).padStart(2,'0')}T07:00:00Z`,finishedAt:null,reportAvailable:true,publishedAt:`2026-10-${String(id+1).padStart(2,'0')}T07:01:00Z`,expiresAt:null,globalScore:score,scoringVersion:11,coverage:1,provisional:false,comparison:{reason,globalDelta:10,domains:[],contributions:[],coverageChanged:false}});
const browser=await chromium.launch(process.env.CLARTE_BROWSER_PATH ? {executablePath:process.env.CLARTE_BROWSER_PATH} : {});const evidence=[];
try {
  for(const width of [320,1280]) for(const lang of ['fr','en']) for(const theme of ['light','dark']) {
    const browserContext=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
    const page=await browserContext.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/account/**',route=>{
      const url=new URL(route.request().url());const path=url.pathname;
      let data={};
      if(path.endsWith('/me')) data={displayName:'Fixture',email:'fixture@example.com',verified:true};
      else if(path.endsWith('/usage')) data={offer:'FREE',period:'2026-10',timezone:'UTC',startsAt:'2026-10-01T00:00:00Z',resetsAt:'2027-01-01T00:00:00Z',used:2,reserved:0,available:null,limit:null,canLaunch:true};
      else if(path.endsWith('/analysis-profiles')) data={defaultProfileId:'server-default-v1',items:[{id:'server-default-v1'}]};
      else if(path.endsWith('/history')) data={context,items:url.searchParams.has('cursor') ? [item(6,50,'NO_PREVIOUS_REPORT')] : [item(9,80,'COMPARABLE'),item(8,70,'METHODOLOGY_CHANGED'),item(7,60,'NO_PREVIOUS_REPORT')],nextCursor:url.searchParams.has('cursor') ? null : '7'};
      return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    const response=await page.goto(base+(lang==='en' ? '/en' : '')+'/account/urls/9/history');assert.equal(response.status(),200);
    const main=page.locator('main');await main.getByRole('heading',{name:context.normalizedUrl}).waitFor();
    assert.equal(await main.locator('[data-segment="comparable"]').count(),1);
    assert.equal(await page.locator('h1').count(),1);
    assert.ok(!(await main.innerText()).includes('Invalid Date'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow');
    const again=main.locator('button[aria-expanded]');
    await again.focus();await page.keyboard.press('Enter');
    assert.equal(await main.locator('input').first().inputValue(),context.normalizedUrl);
    await page.addScriptTag({path:'apps/console-web/node_modules/axe-core/axe.min.js'});
    const violations=await page.evaluate(async()=> (await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
    assert.deepEqual(violations.map(v=>({id:v.id,nodes:v.nodes.length})),[]);
    await again.click();await page.screenshot({path:`${output}/${width}-${lang}-${theme}.png`,fullPage:true});
    await main.getByRole('button',{name:lang==='fr' ? 'Plus anciennes' : 'Older',exact:true}).click();
    await main.getByRole('button',{name:lang==='fr' ? 'Plus récentes' : 'Newest',exact:true}).waitFor();
    assert.equal(await main.getByRole('link',{name:lang==='fr' ? 'Ouvrir le rapport' : 'Open report',exact:true}).getAttribute('href'),(lang==='en' ? '/en' : '')+'/account/runs/6');
    await page.evaluate(()=>window.dispatchEvent(new Event('argos-account-invalid')));
    await main.getByRole('link',{name:lang==='fr' ? 'Se connecter' : 'Sign in',exact:true}).waitFor();
    assert.equal(await main.getByRole('heading',{name:context.normalizedUrl}).count(),0);
    assert.deepEqual(errors,[]);evidence.push({width,lang,theme,keyboard:true,overflow:false,axeViolations:0,pagination:true,revocation:true});
    await browserContext.close();
  }
  await writeFile(output+'/results.json',JSON.stringify({fixture:'mocked same-origin account API; no live audit',checks:evidence},null,2));
  console.log(`${evidence.length} history browser scenarios passed`);
} finally {await browser.close();}
