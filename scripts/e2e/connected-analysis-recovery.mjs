import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import {response,context as fixture} from './connected-analysis-fixture.mjs';
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3020';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output='outputs/ui-review/clarte-analysis-recovery';await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.CLARTE_BROWSER_PATH ? {executablePath:process.env.CLARTE_BROWSER_PATH}:{});
const evidence=[];
try {
  for(const width of [320,390,768,1056])for(const lang of ['fr','en'])for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
    const page=await context.newPage();let key,admissions=0,recoveries=0,accepted=false;
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/account/**',async route=>{
      const url=new URL(route.request().url());let data,status=200;
      if(url.pathname.endsWith('/csrf'))data={csrf:'c'.repeat(43)};
      else if(url.pathname.endsWith('/analyses')) {
        admissions++;key=route.request().headers()['idempotency-key'];accepted=true;
        assert.deepEqual(route.request().postDataJSON(),{url:fixture.normalizedUrl,profileId:'server-default-v1'});
        status=503;data={error:'account_unavailable'};
      }else if(url.pathname.includes('/analyses/')) {
        recoveries++;assert.ok(accepted);assert.equal(url.pathname.split('/').at(-1),key);
        assert.equal(route.request().method(),'GET');data={runId:'42',status:'RUNNING'};
      }else {
        data=response(url.pathname,url.searchParams);
        if(accepted&&url.pathname.endsWith('/usage'))data={...data,used:19,reserved:1,available:0,canLaunch:false};
      }
      if(!data){status=404;data={error:'resource_unavailable'};}
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    const prefix=lang==='en'?'/en':'';
    await page.goto(base+prefix+'/account/analyses/new');
    const launch=page.getByRole('button',{name:lang==='fr'?'Lancer l’analyse':'Start analysis',exact:true});
    await page.getByLabel(lang==='fr'?'URL de la page':'Page URL',{exact:true}).fill(fixture.normalizedUrl);
    await launch.focus();await page.keyboard.press('Enter');
    await page.getByRole('button',{name:lang==='fr'?'Réessayer':'Try again',exact:true}).waitFor();
    assert.equal(admissions,1);
    assert.ok(await page.getByLabel(lang==='fr'?'URL de la page':'Page URL',{exact:true}).getAttribute('readonly')!==null);
    await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
    const file=`uncertain-${lang}-${theme}-${width}.png`;
    await page.screenshot({path:`${output}/${file}`,fullPage:true});
    await page.reload();await page.waitForURL(new RegExp(prefix+'/account/runs/42$'));
    await page.getByText('Runtime',{exact:true}).waitFor();
    assert.equal(admissions,1);assert.equal(recoveries,1);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('argos.pending-analysis')),null);
    assert.equal(await page.locator('h1').count(),1);assert.deepEqual(errors,[]);
    evidence.push({width,lang,theme,admissions,recoveries,screenshot:file});
    await context.close();
  }
}finally{await browser.close();}
await writeFile(`${output}/results.json`,JSON.stringify(evidence,null,2)+'\n');
console.log(`PASS: ${evidence.length} recovery scenarios, no duplicate admissions`);
