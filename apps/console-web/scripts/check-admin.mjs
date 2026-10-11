import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const base="http://localhost:3000",out=new URL("../../../outputs/admin/",import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARGOS_BROWSER_EXECUTABLE});
const contexts=[];
async function write(ctx,path,data,method="post") {
 const {csrf}=await (await ctx.request.get("/api/account/csrf")).json();
 return ctx.request[method](path,{data,headers:{Origin:base,"X-Argos-CSRF":csrf}});
}
async function layout(page) {
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,80),right:e.getBoundingClientRect().right}))}));
 if(overflow.scroll>overflow.width) {await page.screenshot({path:fileURLToPath(new URL("overflow.png",out)),fullPage:true});console.log(overflow);}
 assert.equal(overflow.scroll<=overflow.width,true);
 assert.equal(await page.locator("h1").count(),1);
 assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"),"noindex, nofollow");
}
try {
 const admin=await browser.newContext({baseURL:base,viewport:{width:1280,height:900},colorScheme:"light"});contexts.push(admin);
 assert.equal((await write(admin,"/api/account/auth/login",{email:"admin@example.com",password:"a long synthetic fixture passphrase"})).status(),200);
 const page=await admin.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/account/admin");await page.getByRole("button",{name:"Page suivante",exact:true}).waitFor();
 await page.getByRole("button",{name:"Page suivante",exact:true}).click();await page.getByRole("button",{name:"Première page",exact:true}).click();
 const other=await browser.newContext({baseURL:base});contexts.push(other);
 const email="browser-target-"+Date.now()+"@example.com",password="a long synthetic browser passphrase";
 assert.equal((await write(other,"/api/account/auth/register",{email,password,displayName:"Browser target"})).status(),200);
 const {token}=await (await fetch("http://127.0.0.1:33317/api/__test/mail/"+encodeURIComponent(email))).json();
 assert.equal((await write(other,"/api/account/auth/verify",{token})).status(),200);
 assert.equal((await write(other,"/api/account/auth/login",{email,password})).status(),200);
 assert.equal((await other.request.get("/api/account/admin/users")).status(),403);
 await page.getByLabel("Nom ou email",{exact:true}).fill(email);await page.getByRole("button",{name:"Appliquer les filtres",exact:true}).click();
 await page.getByRole("button",{name:"Consulter Browser target",exact:true}).click();
 await page.getByLabel("Plafond individuel",{exact:true}).fill("0");
 await page.getByRole("checkbox",{name:"Je confirme cette modification d’offre et de plafond.",exact:true}).check();
 await page.getByRole("button",{name:"Enregistrer",exact:true}).click();
 await page.getByText("Modification enregistrée et journalisée.",{exact:true}).waitFor();
 assert.equal((await write(other,"/api/audits",{url:"https://example.com/admin-test",personal:true})).status(),429);
 await page.getByLabel("Plafond individuel",{exact:true}).fill("");
 await page.getByRole("checkbox",{name:"Je confirme cette modification d’offre et de plafond.",exact:true}).check();
 await page.getByRole("button",{name:"Enregistrer",exact:true}).click();
 await page.getByLabel("Plafond individuel",{exact:true}).waitFor();
 // Wait for the actual backend change, not just an old success banner.
 await page.waitForFunction(async()=>{const r=await fetch("/api/account/admin/users?q=Browser%20target");const p=await r.json();const d=await (await fetch("/api/account/admin/users/"+p.items[0].id)).json();return d.monthlyLimit===null;});
 const created=await write(other,"/api/audits",{url:"https://example.com/admin-test",personal:true});assert.equal(created.status(),200);const run=await created.json();
 assert.equal((await fetch("http://127.0.0.1:33317/api/__test/usage/"+run.runId+"/fail",{method:"POST"})).status,200);
 await page.getByRole("region",{name:"Consulter",exact:true}).getByRole("button",{name:"Analyses",exact:true}).click();
 await page.getByRole("link",{name:"Détail",exact:true}).click();await page.getByText("L’analyse a échoué. Les états des modules sont disponibles ci-dessous.",{exact:true}).waitFor();
 await page.getByText("http",{exact:true}).waitFor();
 await page.getByRole("link",{name:"English",exact:true}).click();await page.waitForURL(/\/en\/account\/admin\/runs\//);
 await page.getByRole("link",{name:"Français",exact:true}).click();await page.waitForURL(url=>url.pathname==="/account/admin/runs/"+run.runId);
 await page.getByText("L’analyse a échoué. Les états des modules sont disponibles ci-dessous.",{exact:true}).waitFor();
 await layout(page);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:fileURLToPath(new URL("failure-fr-light.png",out)),fullPage:true});
 const published=await (await write(other,"/api/audits",{url:"https://example.com/admin-report",personal:true})).json();
 assert.equal((await fetch("http://127.0.0.1:33317/api/__test/usage/"+published.runId+"/publish",{method:"POST"})).status,200);
 await page.goto("/account/admin/runs/"+published.runId);await page.getByRole("button",{name:"Ouvrir le rapport",exact:true}).click();
 await page.getByRole("heading",{name:"example.com",level:1,exact:true}).waitFor();
 assert.equal((await other.request.get("/api/account/admin/runs/"+published.runId+"/report")).status(),403);
 await page.getByRole("link",{name:"Retour à l’administration",exact:true}).click();
 await page.getByRole("button",{name:"Journal des modifications",exact:true}).click();await page.getByRole("table").waitFor();await layout(page);
 await page.screenshot({path:fileURLToPath(new URL("events-fr-light.png",out)),fullPage:true});
 await page.getByRole("link",{name:"English",exact:true}).click();await page.getByRole("button",{name:"Users",exact:true}).waitFor();
 await page.getByRole("table").waitFor();
 await page.getByRole("button",{name:"Passer en thème sombre",exact:true}).click();await page.setViewportSize({width:360,height:800});
 await layout(page);await page.keyboard.press("Tab");assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),"BODY");
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:fileURLToPath(new URL("users-en-dark-mobile.png",out))});
 await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});await layout(page);
 await page.screenshot({path:fileURLToPath(new URL("users-en-dark-zoom.png",out)),fullPage:true});
 const users=await (await admin.request.get("/api/account/admin/users?q="+encodeURIComponent(email))).json();
 const events=await (await admin.request.get("/api/account/admin/events")).json();assert.equal(events.items.filter(e=>e.targetId===users.items[0].id).length,2);
 assert.ok(!JSON.stringify(events).includes(email));assert.ok(!JSON.stringify(events).includes("token"));
 assert.equal((await write(admin,"/api/account/auth/logout",{})).status(),200);
 await page.getByRole("button",{name:"Refresh",exact:true}).click();await page.getByText("A verified Argos administrator account is required.",{exact:true}).waitFor();
 assert.equal(await page.getByRole("table").count(),0);assert.deepEqual(errors,[]);
 console.log("Administration browser recipe passed: real cookie BFF/Java, regular account denied, pagination, search, quota zero/reset, analysis failure, event log, FR/EN, mobile, dark, 200% text, keyboard and logout.");
} finally {for(const context of contexts)await context.close();await browser.close();}
