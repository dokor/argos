// Read-only local fixtures: responsive action geometry and queued-domain admission UI.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const { chromium } = process.env.ARGOS_BROWSER_MODULES
  ? createRequire(process.env.ARGOS_BROWSER_MODULES + "/package.json")("playwright")
  : await import("../../apps/playwright-service/node_modules/playwright/index.mjs");
const base = process.env.CONNECTED_BASE_URL ?? "http://127.0.0.1:3047";
assert.ok(["127.0.0.1","localhost"].includes(new URL(base).hostname));
const browser = await chromium.launch({executablePath:process.env.CLARTE_BROWSER_PATH});
const output = "outputs/ui-review/661-670-672";await mkdir(output,{recursive:true});
const results=[];
try {
 for(const [width,lang,theme] of [[1200,"fr","light"],[1200,"fr","dark"],[1200,"en","light"],[1200,"en","dark"],[768,"fr","dark"],[390,"fr","light"],[390,"fr","dark"],[390,"en","light"],[390,"en","dark"],[320,"en","light"]]) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme});
  const page=await context.newPage();
  await page.goto(base+(lang==="en"?"/en":"")+"/account/runs/644");
  const share=page.locator("summary").filter({hasText:lang==="fr"?"Partager ce rapport":"Share this report"});
  const pdf=page.locator("summary").filter({hasText:lang==="fr"?"Exporter en PDF":"Export PDF"});
  await share.waitFor();await pdf.waitFor();
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const a=await share.boundingBox(),b=await pdf.boundingBox();
  assert.ok(Math.abs(a.height-b.height)<0.1,`Same action height ${a.height}/${b.height}`);
  assert.ok(a.height>=44);assert.equal(await share.locator("svg[aria-hidden=true]").count(),1);
  assert.equal(await pdf.locator("svg[aria-hidden=true]").count(),1);
  await share.focus();assert.equal(await share.evaluate(el=>getComputedStyle(el).outlineStyle),"solid");
  await share.press("Enter");assert.equal(await share.evaluate(el=>el.parentElement.open),true);
  await share.press("Enter");await pdf.click();
  assert.equal(await pdf.evaluate(el=>el.parentElement.open),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await pdf.click();await page.screenshot({path:`${output}/report-${width}-${lang}-${theme}.png`,fullPage:true});
  await page.route("**/api/account/domain-discoveries**", async route=>{
   const p=new URL(route.request().url()).pathname;
   assert.equal(route.request().method(),"GET");
   return route.fulfill({json:p.endsWith("/limits")?{maxUrls:200,maxDepth:5,defaultUrls:20,defaultDepth:2,durationSeconds:60}:[{id:"600",domainId:"7",hostname:"first.example",status:"QUEUED"}]});
  });
  await page.route("**/api/account/domain-batches",route=>route.fulfill({json:[{id:"700",domainId:"8",hostname:"second.example",status:"QUEUED"}]}));
  await page.goto(base+(lang==="en"?"/en":"")+"/account/domains/new");
  const urls=page.locator("input[name=maxUrls]"),depth=page.locator("input[name=maxDepth]");
  await page.waitForFunction(()=>document.querySelector("input[name=maxUrls]")?.max==="200");
  await urls.fill("200");await depth.fill("5");
  const submit=page.locator("form").filter({has:urls}).locator("button[type=submit],button:not([type])");
  assert.equal(await submit.isEnabled(),true);
  await urls.fill("201");assert.equal(await urls.evaluate(el=>el.validity.rangeOverflow),true);await urls.fill("200");
  assert.equal(await page.getByRole("link",{name:lang==="fr"?"Reprendre la découverte":"Resume discovery"}).count(),1);
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${output}/domains-${width}-${lang}-${theme}.png`,fullPage:true});
  results.push({width,lang,theme,actionHeight:a.height,passed:true});await context.close();
 }
 await writeFile(output+"/results.json",JSON.stringify(results,null,2));console.log(JSON.stringify(results));
} finally {await browser.close();}
