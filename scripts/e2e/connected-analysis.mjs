import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import { response, context as history } from './connected-analysis-fixture.mjs';
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3020';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local fixture only');
const output='outputs/ui-review/clarte-analysis';await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.CLARTE_BROWSER_PATH ? {executablePath:process.env.CLARTE_BROWSER_PATH} : {});
const evidence=[];
try {
  for(const width of [320,390,768,1056,1440]) for(const lang of ['fr','en']) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
    const page=await context.newPage(),errors=[];let admissions=0,quota=false;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/account/**',async route=>{
      const url=new URL(route.request().url());let status=200,data;
      if(url.pathname.endsWith('/csrf')) data={csrf:'c'.repeat(43)};
      else if(url.pathname.endsWith('/analyses')) {
        admissions++;assert.deepEqual(route.request().postDataJSON(),{url:history.normalizedUrl,profileId:'server-default-v1'});
        assert.match(route.request().headers()['idempotency-key'],/^[a-f0-9-]{36}$/);data={runId:'42',status:'QUEUED'};
      } else data=response(url.pathname,url.searchParams);
      if(quota&&url.pathname.endsWith('/usage')) data={...data,used:20,reserved:0,canLaunch:false};
      if(!data){status=404;data={error:'resource_unavailable'};}
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    const prefix=lang==='en' ? '/en' : '';
    async function visit(path){await page.goto(base+prefix+path);await page.locator('[data-connected-shell] h1').waitFor();}
    async function check(name) {
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('h1').count(),1,name+': one title');
      assert.equal(await page.getByRole('contentinfo').count(),1,name+': footer');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),name+': overflow');
      await page.addScriptTag({path:'apps/console-web/node_modules/axe-core/axe.min.js'});
      const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('[data-connected-shell]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
      assert.deepEqual(violations,[],name);
      const file=`${name}-${lang}-${theme}-${width}.png`;await page.screenshot({path:`${output}/${file}`,fullPage:true});
      evidence.push({name,lang,theme,width,screenshot:file,axeViolations:0,overflow:false});
    }
    await visit('/account/analyses/new');
    const launch=page.getByRole('button',{name:lang==='fr' ? 'Lancer l’analyse':'Start analysis',exact:true});
    await launch.waitFor();await page.locator('code').filter({hasText:'server-default-v1'}).waitFor();
    await check('new');
    await page.getByLabel(lang==='fr' ? 'URL de la page':'Page URL',{exact:true}).fill(history.normalizedUrl);
    await launch.focus();await page.keyboard.press('Enter');await page.waitForURL(/account\/runs\/42$/);
    await page.getByText('Runtime',{exact:true}).waitFor();assert.equal(admissions,1);await check('progress');
    await page.reload();await page.getByText('Runtime',{exact:true}).waitFor();assert.equal(admissions,1,'Reload resumes without admitting again');
    await visit('/account/sites');await page.getByRole('link',{name:'atelier.example',exact:true}).waitFor();await check('sites');
    await page.getByLabel(lang==='fr' ? 'Rechercher un site':'Search websites').fill('missing');
    await page.getByRole('button',{name:lang==='fr' ? 'Rechercher':'Search',exact:true}).click();
    await page.getByRole('heading',{name:lang==='fr' ? 'Aucun résultat pour cette recherche.':'No results for this search.'}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('q'),'missing');
    await visit('/account/sites/7');await page.getByRole('heading',{name:history.normalizedUrl,exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:lang==='fr' ? 'Ouvrir la progression':'Open progress'}).getAttribute('href'),prefix+'/account/runs/45');
    assert.equal(await page.getByRole('link',{name:lang==='fr' ? 'Ouvrir le rapport':'Open report'}).getAttribute('href'),prefix+'/account/runs/43');
    await check('site');
    await page.getByRole('link',{name:lang==='fr' ? 'Ouvrir le rapport':'Open report'}).click();
    await page.getByRole('heading',{name:'atelier.example',exact:true}).waitFor();await check('partial-report');
    assert.equal(await page.locator('a[href="/"]').filter({hasText:/analyse/i}).count(),0);
    if([320,1440].includes(width)) {
      for(const [id,name] of [['44','expired'],['45','failed'],['47','unmeasured'],['48','legacy']]) {
        await visit('/account/runs/'+id);
        await page.getByRole('heading',{name:lang==='fr' ? 'Contexte de cette analyse':'Analysis context'}).waitFor();
        if(['47','48'].includes(id)) await page.getByRole('heading',{name:'atelier.example',exact:true}).waitFor();
        await check(name);
      }
      quota=true;await visit('/account/analyses/new');await page.getByText(lang==='fr' ? 'Configuration par défaut des collecteurs' : 'Default collector configuration',{exact:false}).waitFor();
      assert.equal(await launch.isDisabled(),true);await check('quota');
      await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await check('text-200');
    }
    assert.deepEqual(errors,[]);await context.close();
  }
  await writeFile(`${output}/results.json`,JSON.stringify({browser:browser.version(),fixtures:'Synthetic responses; SQL authorization/admission covered separately in AccountLifecycleIT',checks:evidence},null,2));
  console.log(`${evidence.length} Clarte analysis scenarios passed`);
} finally {await browser.close();}
