import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';
const base=process.env.CONNECTED_BASE_URL??'http://127.0.0.1:3030';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const before=process.env.CLEANUP_BEFORE==='1',output='outputs/ui-review/clarte-cleanup/'+(before?'before':'after');
await mkdir(output,{recursive:true});
const retired=[];
if(!before){
 for(const prefix of ['', '/en'])for(const path of ['/dashboard','/dashboard/analytics','/dashboard/report/42','/login']){
  const response=await fetch(base+prefix+path,{redirect:'manual',headers:{Cookie:'argos_admin=obsolete-synthetic'}});
  assert.equal(response.status,404,prefix+path);assert.equal(response.headers.get('location'),null);retired.push(prefix+path);
 }
 for(const path of ['/api/audits','/api/audits/runs/42','/api/audits/42/history']){
  const response=await fetch(base+path,{headers:{Cookie:'argos_admin=obsolete-synthetic'}});
  assert.equal(response.status,410,path);assert.match(response.headers.get('cache-control'),/no-store/);
 }
}
const browser=await chromium.launch(process.env.CLARTE_BROWSER_PATH?{executablePath:process.env.CLARTE_BROWSER_PATH}:{}),checks=[];
try{
 for(const width of [390,1056])for(const lang of ['fr','en'])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:theme}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/account/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const data=path.endsWith('/auth/providers')?{providers:['google','github','linkedin'],enabled:true}:path.endsWith('/return')?{returnTo:'/account'}:{error:'session_invalid'};
   await route.fulfill({status:'error' in data?401:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  for(const [name,path] of [['public',lang==='fr'?'/':'/en'],['sign-in',(lang==='fr'?'':'/en')+'/account/sign-in']]){
   await page.goto(base+path);await page.locator('h1').waitFor();await page.locator('form input').first().waitFor();await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('h1').count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:output+`/${name}-${lang}-${theme}-${width}.png`,fullPage:true});checks.push({name,lang,theme,width});
  }
  assert.deepEqual(errors,[]);await ctx.close();
 }
 await writeFile(output+'/results.json',JSON.stringify({retired,checks},null,2));console.log(`${checks.length} public/auth visual checks; ${retired.length} obsolete routes absent`);
}finally{await browser.close();}
