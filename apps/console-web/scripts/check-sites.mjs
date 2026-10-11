import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const base="http://localhost:3000",out=new URL("../../../outputs/sites/",import.meta.url);
await mkdir(out,{recursive:true});
const fr=JSON.parse(await readFile(new URL("../src/lib/i18n/fr.json",import.meta.url),"utf8")).account;
const browser=await chromium.launch({headless:true,executablePath:process.env.ARGOS_BROWSER_EXECUTABLE});
const contexts=[];
async function mutation(ctx,path,data) {
  const {csrf}=await (await ctx.request.get("/api/account/csrf")).json();
  return ctx.request.post(path,{data,headers:{Origin:base,"X-Argos-CSRF":csrf}});
}
async function verified(ctx,email) {
  assert.equal((await mutation(ctx,"/api/account/auth/register",{email,password:"a long synthetic browser passphrase",displayName:"Sites Fixture"})).status(),200);
  const mail=await fetch("http://127.0.0.1:33317/api/__test/mail/"+encodeURIComponent(email));
  const {token}=await mail.json();
  assert.equal((await mutation(ctx,"/api/account/auth/verify",{token})).status(),200);
}
async function login(page,email) {
  await page.goto("/account/sign-in");
  await page.getByLabel(fr.email,{exact:true}).fill(email);
  await page.getByLabel(fr.password,{exact:true}).fill("a long synthetic browser passphrase");
  await page.getByRole("button",{name:fr.signIn,exact:true}).click();
  await page.waitForURL(base+"/account/sites");
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  assert.equal(await page.locator("h1").count(),1);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"),"noindex, nofollow");
}
try {
  const a=await browser.newContext({baseURL:base,viewport:{width:1280,height:900},colorScheme:"light"});contexts.push(a);
  const email="sites-"+Date.now()+"@example.com";
  await verified(a,email);const page=await a.newPage();await page.clock.install();await login(page,email);
  await page.getByText(fr.sites.empty).waitFor();await noOverflow(page);
  await page.screenshot({path:fileURLToPath(new URL("empty-fr-light.png",out)),fullPage:true});
  await page.getByLabel(fr.sites.url,{exact:true}).fill("https://example.com/path?q=1");
  await page.getByRole("button",{name:fr.sites.add,exact:true}).last().click();
  await page.waitForURL(/\/account\/sites\/[0-9]+$/);
  const sitePath=new URL(page.url()).pathname,siteId=sitePath.split("/").pop();
  await page.getByRole("heading",{name:"example.com",exact:true}).waitFor();
  assert.equal((await (await a.request.get("/api/account/runs")).json()).length,0,"Follow must not create a run");
  await page.getByLabel(fr.sites.url,{exact:true}).fill("https://www.example.com/page");
  await page.getByRole("button",{name:fr.sites.addUrl,exact:true}).last().click();
  await page.getByRole("alert").filter({hasText:fr.sites.mismatch}).waitFor();
  await page.getByLabel(fr.sites.url,{exact:true}).fill("https://example.com/another?q=2");
  await page.getByRole("button",{name:fr.sites.addUrl,exact:true}).last().click();
  await page.getByRole("heading",{name:"https://example.com/another?q=2",exact:true}).waitFor();
  await page.getByRole("button",{name:fr.sites.analyse,exact:true}).click();
  await page.getByLabel("URL à analyser",{exact:true}).fill("https://example.com/path?q=1");
  await page.getByRole("button",{name:fr.sites.again,exact:true}).first().click();
  await page.waitForURL(/\/account\/runs\/[0-9]+$/);
  const runId=new URL(page.url()).pathname.split("/").pop();
  await page.getByRole("link",{name:fr.sites.back,exact:true}).click();
  await page.waitForURL(base+sitePath);
  await page.getByRole("link",{name:fr.sites.progress,exact:true}).waitFor();
  await noOverflow(page);
  await page.screenshot({path:fileURLToPath(new URL("detail-fr-light.png",out)),fullPage:true});
  await page.getByRole("link",{name:"English",exact:true}).click();
  await page.waitForURL(base+"/en"+sitePath);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Passer en thème sombre",exact:true}).click();
  await noOverflow(page);
  await page.keyboard.press("Tab");
  assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),"BODY");
  await page.screenshot({path:fileURLToPath(new URL("detail-en-dark-390.png",out)),fullPage:true});
  await page.setViewportSize({width:360,height:800});await noOverflow(page);
  await page.screenshot({path:fileURLToPath(new URL("detail-en-dark-360.png",out)),fullPage:true});
  await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
  await noOverflow(page);
  await page.screenshot({path:fileURLToPath(new URL("detail-en-dark-zoom.png",out)),fullPage:true});
  let backgroundReads=0;
  const countRead=request=>{if(request.method()==="GET" && /\/api\/account\/(?:sites|me)(?:[/?]|$)/.test(request.url()))backgroundReads++;};
  page.on("request",countRead);
  const renewal=page.waitForResponse(response=>response.url().endsWith("/api/account/auth/renew")&&response.request().method()==="POST");
  await page.clock.fastForward(600000);assert.equal((await renewal).status(),200);
  assert.equal(backgroundReads,0,"Renewal must not create artificial business reads");page.off("request",countRead);
  // A second real account follows the same URL and must see no first-owner run.
  const b=await browser.newContext({baseURL:base});contexts.push(b);
  const emailB="sites-b-"+Date.now()+"@example.com";await verified(b,emailB);
  assert.equal((await mutation(b,"/api/account/auth/login",{email:emailB,password:"a long synthetic browser passphrase"})).status(),200);
  const added=await (await mutation(b,"/api/account/sites",{url:"https://example.com/path?q=1"})).json();
  assert.notEqual(added.site.siteId,siteId);
  assert.equal((await b.request.get("/api/account/sites/"+siteId)).status(),404);
  assert.equal((await b.request.get("/api/account/runs/"+runId)).status(),404);
  const urls=await (await b.request.get("/api/account/sites/"+added.site.siteId+"/urls")).json();
  assert.equal(urls.items[0].latestAttempt,null);
  // Browser-bound anonymous proof becomes a followed URL without a new run.
  const c=await browser.newContext({baseURL:base});contexts.push(c);
  const anonymous=await (await c.request.post("/api/audits",{data:{url:"https://example.com/claimed"}})).json();
  assert.equal((await mutation(c,"/api/account/auth/login",{email:emailB,password:"a long synthetic browser passphrase"})).status(),200);
  assert.equal((await mutation(c,"/api/account/runs/"+anonymous.runId+"/claim",{})).status(),200);
  const followed=await (await c.request.get("/api/account/sites/"+added.site.siteId+"/urls")).json();
  assert.ok(followed.items.some(row=>row.latestAttempt?.runId===String(anonymous.runId)));
  // Controlled UI-only states; API/ownership behavior is verified above and in MariaDB tests.
  const route="**/api/account/sites/"+siteId+"/urls*";
  const stateItems=[
    {siteUrlId:"fixture-failed",auditId:"1",normalizedUrl:"https://example.com/failed-with-older-report",latestAttempt:{runId,status:"FAILED",createdAt:"2026-10-11T08:00:00Z"},latestAvailableReport:{runId,publishedAt:"2026-10-10T08:00:00Z",expiresAt:null,globalScore:81,provisional:true}},
    {siteUrlId:"fixture-unknown",auditId:"2",normalizedUrl:"https://example.com/score-absent",latestAttempt:{runId,status:"COMPLETED",createdAt:"2026-10-10T08:00:00Z"},latestAvailableReport:{runId,publishedAt:"2026-10-10T08:00:00Z",expiresAt:null,globalScore:null,provisional:null}},
    {siteUrlId:"fixture-expired",auditId:"3",normalizedUrl:"https://example.com/report-expired",latestAttempt:{runId,status:"COMPLETED",createdAt:"2026-10-09T08:00:00Z"},latestAvailableReport:null}
  ];
  await page.route(route,r=>r.fulfill({json:{items:stateItems,nextCursor:null}}));
  await page.goto("/en"+sitePath);await page.getByText("81/100",{exact:false}).waitFor();
  await noOverflow(page);await page.screenshot({path:fileURLToPath(new URL("states-en-dark-mobile-ui-fixture.png",out)),fullPage:true});
  await page.unroute(route);await page.goto("/en"+sitePath);
  await page.getByRole("heading",{name:"example.com",exact:true}).waitFor();
  // Revoke the visible account: the next private read clears its displayed data.
  assert.equal((await mutation(a,"/api/account/me/archive",{confirmed:true})).status(),200);
  await page.getByRole("button",{name:"Refresh",exact:true}).click();
  await page.waitForURL(/\/account\/sign-in\?returnTo=/);
  assert.equal(await page.getByText("https://example.com/path?q=1",{exact:true}).count(),0);
  assert.equal((await a.request.get("/api/account/sites")).status(),401);
  console.log("Mes sites E2E passed: follow, multiple URLs, private launch/return, isolation, anonymous claim, archive, FR/EN, 360/390, keyboard and 200% text.");
} finally {for(const ctx of contexts)await ctx.close();await browser.close();}
