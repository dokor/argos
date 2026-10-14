import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const base="http://localhost:3000",out=new URL("../../../outputs/usage/",import.meta.url);
await mkdir(out,{recursive:true});
const fr=JSON.parse(await readFile(new URL("../src/lib/i18n/fr.json",import.meta.url),"utf8")).account;
const browser=await chromium.launch({headless:true,executablePath:process.env.ARGOS_BROWSER_EXECUTABLE});
const contexts=[];
async function mutation(ctx,path,data) {
  const {csrf}=await (await ctx.request.get("/api/account/csrf")).json();
  return ctx.request.post(path,{data,headers:{Origin:base,"X-Argos-CSRF":csrf}});
}
async function account(ctx,email) {
  assert.equal((await mutation(ctx,"/api/account/auth/register",{email,password:"a long synthetic browser passphrase",displayName:"Usage Fixture"})).status(),200);
  const {token}=await (await fetch("http://127.0.0.1:33317/api/__test/mail/"+encodeURIComponent(email))).json();
  assert.equal((await mutation(ctx,"/api/account/auth/verify",{token})).status(),200);
  assert.equal((await mutation(ctx,"/api/account/auth/login",{email,password:"a long synthetic browser passphrase"})).status(),200);
}
async function usage(ctx) {const r=await ctx.request.get("/api/account/usage");assert.equal(r.status(),200);return r.json();}
async function finish(id,action) {assert.equal((await fetch(`http://127.0.0.1:33317/api/__test/usage/${id}/${action}`,{method:"POST"})).status,200);}
async function layout(page) {assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator("h1").count(),1);assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"),"noindex, nofollow");}
try {
  const a=await browser.newContext({baseURL:base,viewport:{width:1280,height:900},colorScheme:"light"});contexts.push(a);
  await account(a,"usage-"+Date.now()+"@example.com");
  const initial=await usage(a);assert.equal(initial.limit,2,"Start the local fixture with -Dargos.usage.fixture-limit=2");assert.equal(initial.used,0);assert.equal(initial.reserved,0);assert.equal(initial.timezone,"UTC");
  assert.equal(typeof initial.resetsAt,"string");assert.match(initial.resetsAt,/^\d{4}-\d{2}-01T00:00:00Z$/);assert.ok(new Date(initial.resetsAt).getTime()>Date.now());
  const added=await (await mutation(a,"/api/account/sites",{url:"https://example.com/usage"})).json();assert.ok(added.site.siteId);
  const first=await (await mutation(a,"/api/audits",{url:"https://example.com/usage",personal:true})).json();
  const second=await (await mutation(a,"/api/audits",{url:"https://example.com/usage",personal:true})).json();
  assert.equal((await usage(a)).reserved,2);
  const denied=await mutation(a,"/api/audits",{url:"https://example.com/usage",personal:true});assert.equal(denied.status(),429);assert.equal((await denied.json()).error,"quota_exceeded");assert.ok(denied.headers()["retry-after"]);
  const page=await a.newPage();await page.goto("/account/usage");await page.getByRole("heading",{name:"Mon quota mensuel",exact:true}).waitFor();
  await page.getByText(fr.usage.reached,{exact:true}).waitFor();
  await page.goto("/account/analyses/new");await page.locator("code").filter({hasText:"server-default-v1"}).waitFor();assert.equal(await page.getByRole("button",{name:"Lancer l’analyse",exact:true}).isDisabled(),true);
  await page.goto("/account/usage");await page.getByRole("heading",{name:"Mon quota mensuel",exact:true}).waitFor();
  assert.equal((await a.request.get("/api/account/sites")).status(),200);assert.equal((await mutation(a,"/api/account/sites",{url:"https://example.com/extra"})).status(),200);
  await layout(page);await page.screenshot({path:fileURLToPath(new URL("capacity-fr-light.png",out)),fullPage:true});
  await page.getByRole("heading",{name:"Mon quota mensuel",exact:true}).locator("..").screenshot({path:fileURLToPath(new URL("panel-fr-light.png",out))});
  // Test-only controls exercise real publication/failure transactions, without invoking remote modules.
  await finish(first.runId,"publish");let state=await usage(a);assert.equal(state.used,1);assert.equal(state.reserved,1);assert.equal(state.canLaunch,false);
  await finish(second.runId,"fail");state=await usage(a);assert.equal(state.used,1);assert.equal(state.reserved,0);assert.equal(state.canLaunch,true);
  await page.getByRole("button",{name:fr.usage.refresh,exact:true}).click();
  await page.getByText(fr.usage.reached,{exact:true}).waitFor({state:"hidden"});
  await page.goto("/account/analyses/new");await page.locator("code").filter({hasText:"server-default-v1"}).waitFor();assert.equal(await page.getByRole("button",{name:"Lancer l’analyse",exact:true}).isDisabled(),false);
  await page.goto("/account/usage");await page.getByRole("heading",{name:"Mon quota mensuel",exact:true}).waitFor();
  const report=await a.request.get(`/api/account/runs/${first.runId}/report`);assert.equal(report.status(),200);assert.equal((await report.json()).scores.coverage.provisional,true);
  const b=await browser.newContext({baseURL:base});contexts.push(b);await account(b,"usage-b-"+Date.now()+"@example.com");assert.equal((await usage(b)).used,0);assert.equal((await b.request.get(`/api/account/runs/${first.runId}/report`)).status(),404);
  const c=await browser.newContext({baseURL:base});contexts.push(c);
  const anon=await (await c.request.post("/api/audits",{data:{url:"https://example.com/anonymous"}})).json();await finish(anon.runId,"publish");
  await account(c,"usage-c-"+Date.now()+"@example.com");assert.equal((await mutation(c,`/api/account/runs/${anon.runId}/claim`,{})).status(),200);assert.equal((await mutation(c,`/api/account/runs/${anon.runId}/claim`,{})).status(),200);assert.equal((await usage(c)).used,1);
  await page.getByRole("link",{name:"English",exact:true}).click();await page.setViewportSize({width:360,height:800});await page.getByRole("button",{name:"Passer en thème sombre",exact:true}).click();
  await page.getByRole("heading",{name:"Monthly usage",exact:true}).waitFor();await layout(page);await page.keyboard.press("Tab");assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),"BODY");
  await page.screenshot({path:fileURLToPath(new URL("usage-en-dark-mobile.png",out)),fullPage:true});
  await page.getByRole("heading",{name:"Monthly usage",exact:true}).locator("..").screenshot({path:fileURLToPath(new URL("panel-en-dark-mobile.png",out))});
  await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});await layout(page);await page.screenshot({path:fileURLToPath(new URL("usage-en-dark-zoom.png",out)),fullPage:true});
  assert.equal((await mutation(a,"/api/account/me/archive",{confirmed:true})).status(),200);
  await page.getByRole("button",{name:"Refresh usage",exact:true}).click();await page.waitForURL(/\/en\/account\/sign-in/);assert.equal(await page.getByRole("heading",{name:"Monthly usage",exact:true}).count(),0);
  console.log("Usage browser recipe passed: shared capacity, partial publication, failure release, anonymous claim once, owner isolation, FR/EN, mobile, dark, keyboard, zoom and revocation.");
} finally {for(const c of contexts) await c.close();await browser.close();}
