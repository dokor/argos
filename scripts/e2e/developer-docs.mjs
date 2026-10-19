import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import {errorDiagnostic} from '../ci/ci-errors.mjs';
import {injectAxe} from './inject-axe.mjs';
const base=process.env.DOCS_BASE_URL??process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3000';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output='outputs/ui-review/developer-docs';await mkdir(output,{recursive:true});
const catalog=JSON.parse(await readFile('apps/console-web/src/lib/ci-error-catalog.json','utf8')).errors;
const templates=JSON.parse(await readFile('apps/console-web/src/lib/ci-integration-templates.json','utf8'));
const api=JSON.parse(await readFile('docs/ci/openapi-v1.json','utf8'));
const browser=await chromium.launch(),results=[];
const topics=['','auth','domains','github','gitlab','issues','api','errors','usage','changelog'];
try{
 for(const width of [320,390,768,1440])for(const lang of ['fr','en'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,permissions:['clipboard-read','clipboard-write']});
  const external=[],machine=[],errors=[];
  await context.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path.startsWith('/api/ci/'))machine.push(path);
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/session')?{signedIn:false}:{enabled:false,choice:'unset'})});
  });
  await context.route('https://**/*',route=>{external.push(new URL(route.request().url()).origin);return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const root=(lang==='en'?'/en':'')+'/docs',fr=lang==='fr',state=width+'-'+lang+'-'+theme;
  const chosen=[320,1440].includes(width)?topics:['','github','gitlab','errors'];
  for(const topic of chosen){
   const path=root+(topic?'/'+topic:'');
   assert.equal((await page.goto(base+path)).status(),200,path);
   await page.getByRole('heading',{level:1}).waitFor();await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('h1').count(),1);
   assert.equal(await page.locator('html').getAttribute('lang'),lang);
   assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://argos.lelouet.fr'+path);
   for(const locale of ['fr','en'])assert.equal(await page.locator('link[hreflang="'+locale+'"]').count(),1);
   assert.ok((await page.locator('meta[name="robots"]').getAttribute('content')).includes('index'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'overflow '+state+path);
   const missing=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(a=>a.hash.slice(1)).filter(id=>!document.getElementById(id)));
   assert.deepEqual(missing,[]);
   if(topic==='errors'){
    // Exercise the exact diagnostic URLs emitted by #741, including hyphen anchors.
    for(const [code,e]of Object.entries(catalog)){
     const payload={schemaVersion:1,requestId:'69b1ce84-2761-4973-84f3-21e272583d81',error:{code,stage:e.stage,category:e.category,messageKey:e.messageKey,actionCode:e.actionCode,retryable:e.retryable,recovery:e.recovery,retryAfterSeconds:null}};
     const diagnostic=errorDiagnostic(JSON.stringify(payload),{contentType:'application/json',httpStatus:e.httpStatus,lang});
     const target=diagnostic.documentationPath.split('#')[1];
     assert.equal(await page.locator('#'+target).count(),1,code);
    }
    const input=page.getByLabel(fr?'Chercher un code ou une action':'Find a code or action');
    await input.fill('AUTHENTICATION_FAILED');assert.equal(await page.locator('article').count(),1);
    await input.fill('zz-not-found');assert.equal(await page.locator('article').count(),0);
    await page.getByRole('button',{name:fr?'Effacer les filtres':'Clear filters',exact:true}).click();
    assert.equal(await page.locator('article').count(),Object.keys(catalog).length);assert.ok(await input.evaluate(el=>el===document.activeElement));
    await page.goto(base+root+'/errors#authentication-failed');
    const pos=await page.locator('#authentication-failed').boundingBox(),header=await page.locator('header').boundingBox();
    assert.ok(pos.y>=header.height,'anchor hidden by header '+state);
   }
   if(topic==='github'||topic==='gitlab'){
    const select=page.getByLabel(fr?'Modèle à copier':'Template to copy');
    await select.selectOption('preview');
    const expected=topic==='github'?templates.templates.githubPreview:templates.templates.gitlabPreview;
    assert.equal(await page.locator('pre code').first().textContent(),expected);
    await page.getByRole('button',{name:topic==='github'?/\.github\/workflows/:/\.gitlab-ci/}).click();
    assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'),expected);
    await select.selectOption('publication');
    assert.equal(await page.locator('pre code').first().textContent(),topic==='github'?templates.templates.github:templates.templates.gitlabPublication);
   }
   if(topic===''&&width<=390){
    const menu=page.getByRole('button',{name:/Rubriques de la documentation|Documentation topics/});await menu.click();
    const input=page.getByLabel(fr?'Rechercher dans les guides':'Search the guides');
    await input.fill('zznotfound');assert.equal(await page.getByRole('navigation',{name:fr?'Rubriques':'Topics',exact:true}).getByRole('link').count(),0);
    await page.getByRole('button',{name:fr?'Effacer':'Clear',exact:true}).click();
    await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');assert.ok(await menu.evaluate(el=>el===document.activeElement));
   }
   if((width===1440&&lang==='fr'&&theme==='light')||(width===390&&lang==='en'&&theme==='dark')){
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:output+'/'+(topic||'start')+'-'+state+'.png'});
   }
   results.push({width,lang,theme,topic:topic||'start',status:200,overflow:false});
  }
  if(width===1440){
   await page.goto(base+root);await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('href'),'#docs-main');
   await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'docs-main');
   await injectAxe(page);
   const violations=await page.evaluate(async()=>(await window.axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.length})));
   assert.deepEqual(violations,[],'axe '+state);
  }
  assert.deepEqual(machine,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  await context.close();
 }
 const page=await browser.newPage(),download=await page.request.get(base+'/docs/openapi-v1.json');
 assert.equal(download.status(),200);assert.ok(download.headers()['content-type'].includes('application/json'));assert.deepEqual(await download.json(),api);
 const sitemap=await (await page.request.get(base+'/sitemap.xml')).text();
 for(const topic of topics)for(const lang of ['','/en'])assert.ok(sitemap.includes('https://argos.lelouet.fr'+lang+'/docs'+(topic?'/'+topic:'')));
 assert.equal((await page.request.get(base+'/docs/unknown-topic')).status(),404);
 for(const p of ['/account','/en/account','/report/example']){const res=await page.request.get(base+p);assert.ok((res.headers()['x-robots-tag']??'').includes('noindex'),p);}
 await writeFile(output+'/results.json',JSON.stringify({browser:browser.version(),cases:results},null,2));
 console.log('Developer docs: '+results.length+' public cases; canonical error URLs, templates, copy, metadata, download, keyboard and local-only behavior verified.');
}finally{await browser.close();}
