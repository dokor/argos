import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {response as accountResponse} from './connected-usage-fixture.mjs';
import fr from '../../apps/console-web/src/lib/i18n/fr.json' with {type:'json'};
import en from '../../apps/console-web/src/lib/i18n/en.json' with {type:'json'};

const {chromium} = await import(process.env.ARGOS_PLAYWRIGHT_MODULE ?? '../../apps/playwright-service/node_modules/playwright/index.mjs');
const base = process.env.CONNECTED_BASE_URL ?? 'http://127.0.0.1:3044';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname), 'Local fixture only');
const output = 'outputs/ui-review/usage-timeline';
await mkdir(output, {recursive:true});
const browser = await chromium.launch(process.env.CLARTE_BROWSER_PATH ? {executablePath:process.env.CLARTE_BROWSER_PATH} : {});
const evidence = [];

function timeline(params, mode) {
  const granularity = params.get('granularity'), dimension = params.get('dimension'), from = params.get('from'), until = params.get('until');
  const boundaries = [from];
  while (boundaries.at(-1) < until) {
    const day = new Date(boundaries.at(-1));
    if (granularity === 'DAY') day.setUTCDate(day.getUTCDate()+1);
    if (granularity === 'MONTH') day.setUTCMonth(day.getUTCMonth()+1);
    if (granularity === 'YEAR') day.setUTCFullYear(day.getUTCFullYear()+1);
    boundaries.push(day.toISOString().slice(0,10));
  }
  const options = [{key:'10',label:dimension === 'URL' ? 'https://atelier.example/collection/une-url-longue?tri=date&categorie=toutes' : 'atelier.example',total:42},{key:'11',label:dimension === 'URL' ? 'https://www.atelier.example/contact' : 'www.atelier.example',total:18}];
  const selected = params.getAll('filter');
  let series = dimension === 'GLOBAL' ? [{key:'total',label:'total',total:0}] : options.filter(option=>!selected.length||selected.includes(option.key)).map(option=>({...option,total:0}));
  const buckets = boundaries.slice(0,-1).map((date,index)=>{
    const values={};
    for (const item of series) {const value=mode==='empty'?0:(index*3+Number(item.key==='total'?2:item.key))%8; values[item.key]=value;item.total+=value;}
    return {from:date,until:boundaries[index+1],total:Object.values(values).reduce((a,b)=>a+b,0),values};
  });
  const total=series.reduce((sum,item)=>sum+item.total,0);
  if(!total)series=[];
  return {timezone:'UTC',snapshotAt:new Date().toISOString(),coverageFrom:boundaries[Math.min(3,boundaries.length-1)]+'T12:00:00Z',undatedCredits:1,granularity,dimension,total,series,buckets,options,moreOptions:false};
}

try {
  for (const width of [320,390,768,1440]) for (const lang of ['fr','en']) for (const theme of ['light','dark']) {
    // Webpack's development eval scripts conflict with the production CSP. Opt in only for a local dev preview.
    const context = await browser.newContext({viewport:{width,height:1000},colorScheme:theme,bypassCSP:process.env.CLARTE_DEV_PREVIEW==='true'});
    const page = await context.newPage(), copy=(lang==='fr'?fr:en).usageTimeline, errors=[];
    page.setDefaultNavigationTimeout(120000);
    let mode='normal';
    page.on('pageerror', error=>errors.push(error.message));
    await page.route('**/api/account/**', async route=>{
      const url=new URL(route.request().url());
      let data=accountResponse(url.pathname,url.searchParams),status=200;
      if(url.pathname.endsWith('/usage/timeline')) {
        if(mode==='error'){status=503;data={error:'account_unavailable'};}
        else data=timeline(url.searchParams,mode);
      }
      await route.fulfill({status:data?status:404,contentType:'application/json',body:JSON.stringify(data??{error:'resource_unavailable'})});
    });
    await page.goto(base+(lang==='en'?'/en':'')+'/account/usage');
    const section=page.getByRole('region',{name:copy.title,exact:true});
    await section.getByRole('button',{name:new RegExp(copy.selectPeriod)}).first().waitFor({timeout:60000}).catch(async error=>{
      await page.screenshot({path:output+'/debug.png',fullPage:true});
      console.error(await page.locator('body').innerText(),errors);
      throw error;
    });
    const check=async name=>{
      await page.evaluate(()=>document.fonts.ready);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${name}/${width}: page overflow`);
      assert.equal(await page.locator('h1').count(),1);
      const screenshot=`${name}-${lang}-${theme}-${width}.png`;
      await section.screenshot({path:output+'/'+screenshot});evidence.push({name,lang,theme,width,screenshot});
    };
    await check('daily');
    await section.getByRole('combobox',{name:copy.granularity,exact:true}).selectOption('MONTH');
    await section.getByRole('button',{name:new RegExp(copy.selectPeriod)}).first().waitFor();
    await section.getByRole('combobox',{name:copy.dimension,exact:true}).selectOption('DOMAIN');
    await section.getByText(copy.filters,{exact:true}).click();
    await section.getByRole('checkbox',{name:'atelier.example 42',exact:true}).check();
    await section.getByRole('button',{name:new RegExp(copy.selectPeriod)}).first().waitFor();
    assert.equal(await section.getByRole('checkbox',{name:'atelier.example 42',exact:true}).isChecked(),true);
    await section.getByRole('checkbox',{name:'www.atelier.example 18',exact:true}).check();
    await section.getByRole('button',{name:new RegExp(copy.selectPeriod)}).first().waitFor();
    const point=section.getByRole('button',{name:new RegExp(copy.selectPeriod)}).first();await point.focus();
    assert.ok(await section.getByRole('status').innerText());
    await section.getByText(copy.table,{exact:true}).click();
    assert.ok(await section.getByRole('table').isVisible());await check('monthly-filtered');
    if([390,1440].includes(width)) {
      await section.getByRole('combobox',{name:copy.dimension,exact:true}).selectOption('URL');
      await section.getByRole('checkbox',{name:'https://atelier.example/collection/une-url-longue?tri=date&categorie=toutes 42',exact:true}).waitFor();
      await check('urls');
    }
    await section.getByRole('button',{name:copy.clear,exact:true}).click();
    await section.getByRole('combobox',{name:copy.granularity,exact:true}).selectOption('YEAR');
    await section.getByRole('button',{name:new RegExp(copy.selectPeriod)}).first().waitFor();await check('annual');
    if(width===390) {
      mode='empty';await page.getByRole('button',{name:(lang==='fr'?fr:en).usagePage.refresh,exact:true}).click();
      await section.getByRole('heading',{name:copy.empty}).waitFor();await check('empty');
      mode='error';await page.getByRole('button',{name:(lang==='fr'?fr:en).usagePage.refresh,exact:true}).click();
      await section.getByRole('alert').waitFor();await check('error');
      mode='normal';await section.getByRole('button',{name:copy.retry,exact:true}).click();
      await section.getByRole('button',{name:new RegExp(copy.selectPeriod)}).first().waitFor();
    }
    assert.deepEqual(errors,[]);await context.close();
  }
  await writeFile(output+'/results.json',JSON.stringify({fixtures:'Synthetic usage aggregates; no real account data',browser:browser.version(),checks:evidence},null,2));
  console.log(`${evidence.length} usage timeline visual scenarios passed`);
} finally { await browser.close(); }
