import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const root=path.resolve("apps/console-web");
const require=createRequire(path.join(root,"package.json"));const ts=require("typescript");
const source=fs.readFileSync(path.join(root,"src/components/marketing/reportDemoFixture.ts"),"utf8");
const {demoReport}=await import("data:text/javascript;base64,"+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64"));
const api=http.createServer((req,res)=>{
  res.setHeader("Content-Type","application/json");const key=req.url.split("/")[3];
  if(key==="fixture-valid"&&!req.url.endsWith("/status"))return res.end(JSON.stringify(demoReport("fr")));
  if(req.url.endsWith("/status")&&["fixture-queued","fixture-running","fixture-failed"].includes(key))return res.end(JSON.stringify({status:key.split("-")[1].toUpperCase(),moduleStatuses:"[]"}));
  res.statusCode=404;res.end("{}");
});await new Promise(resolve=>api.listen(3091,"127.0.0.1",resolve));
const server=spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"start","-p","3090"],{cwd:root,env:{...process.env,API_BASE:"http://127.0.0.1:3091"},stdio:"pipe",windowsHide:true});
let diagnostics="";server.stderr.on("data",chunk=>diagnostics+=chunk);server.stdout.on("data",()=>{});
try {
  let ready=false;for(let n=0;n<80;n++){try{const r=await fetch("http://localhost:3090/robots.txt");if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,diagnostics);
  const rows=[]; const dictionaries = Object.fromEntries(["fr","en"].map(lang => [lang, JSON.parse(fs.readFileSync(path.join(root,"src/lib/i18n/"+lang+".json"),"utf8"))]));
  for(const prefix of ["","/en"])for(const state of ["valid","queued","running","failed","expired","unknown"]){
    const route=prefix+"/report/fixture-"+state;const r=await fetch("http://localhost:3090"+route,{headers:{"User-Agent":"Googlebot"}});const html=await r.text();
    assert.equal(r.status,200,route+" (current soft error behavior)");assert.equal(r.headers.get("x-robots-tag"),"noindex, nofollow",route);
    assert.match(html,/<meta name="robots" content="noindex, nofollow"/);assert.doesNotMatch(html,/<link rel="canonical"/);assert.doesNotMatch(html,/<link rel="alternate"[^>]*hrefLang/);
    const marker=state==="valid"?"atelier.example":state==="failed"?(prefix?"Audit failed":"Analyse échouée"):["expired","unknown"].includes(state)?(prefix?"Report not found":"Rapport introuvable"):(prefix?"in progress":"en cours");
    // State routing is also checked through rendered titles/content below; error copy may evolve.
    if(state==="valid")assert.ok(html.includes(marker),route);
    const dict = dictionaries[prefix ? "en" : "fr"];
    const expected = state === "failed" ? dict.report.unavailable.failed.title : ["expired","unknown"].includes(state) ? dict.report.unavailable.notFound.title : ["queued","running"].includes(state) ? dict.report.progress.titleQueued : null;
    if(expected) assert.ok(html.includes(expected.replaceAll("&", "&amp;").replaceAll("\u0027", "&#x27;").replaceAll("<","&lt;").replaceAll(">","&gt;")), route+" state content missing");
    rows.push({route,status:r.status,xRobots:r.headers.get("x-robots-tag"),meta:"noindex, nofollow",canonical:false});
  }
  const robots=await(await fetch("http://localhost:3090/robots.txt")).text();assert.doesNotMatch(robots,/Disallow: (\/en)?\/report\//);
  const sitemap=await(await fetch("http://localhost:3090/sitemap.xml")).text();assert.ok(!sitemap.includes("/report/"));
  for(const route of ["/","/en","/exemple-rapport","/en/example-report"]){const html=await(await fetch("http://localhost:3090"+route)).text();assert.doesNotMatch(html,/href=["'][^"']*\/report\//);}
  fs.mkdirSync("docs/testing/epic-373",{recursive:true});fs.writeFileSync("docs/testing/epic-373/report-indexing.json",JSON.stringify(rows,null,2)+"\n");console.log("12 controlled report HTTP/SSR scenarios and crawl/sitemap/public-link checks passed.");
}finally{server.kill();await new Promise(resolve=>api.close(resolve));}
