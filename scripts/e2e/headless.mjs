// Dedicated fixture harness; production entry points never enable these degraded responses.
import express from '../../apps/playwright-service/node_modules/express/index.js';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import lighthouse from '../../apps/lighthouse-service/node_modules/lighthouse/core/index.js';
import { launch, Launcher } from '../../apps/lighthouse-service/node_modules/chrome-launcher/dist/index.js';
import { createRuntimeApp } from '../../apps/playwright-service/app.mjs';
import { createLighthouseServer } from '../../apps/lighthouse-service/app.mjs';
import { createLighthouseCollector } from '../../apps/lighthouse-service/collector.mjs';
import { createEgressProxy } from '../../apps/audit-egress/proxy.mjs';
import http from 'node:http';
import puppeteer from '../../apps/lighthouse-service/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

// A fixture-only transport maps one literal public surrogate to the local sample.
// No production policy/validator bypass, DNS queries, or third-party connections.
const proxyServer=createEgressProxy({request:(options,callback)=>{
  if(options.host!=='8.8.8.8')throw new Error('Only controlled fixture transport allowed');
  return http.request({...options,host:'127.0.0.1',port:3020},callback);
},connect:()=>{throw new Error('Fixture has no TLS endpoint');}});
proxyServer.listen(3328,'127.0.0.1');
const proxy='http://127.0.0.1:3328';
// Sandbox isolation is exercised in the Docker security job. This UI-only fixture
// runner retains its prior explicit launch flags for hosts without user namespaces.
const fixtureChromium={launch:options=>chromium.launch({...options,chromiumSandbox:false,args:[...options.args,'--no-sandbox']})};
// Keep this HTTP-only fixture on HTTP: Chromium's automatic HTTPS-first modes
// otherwise stop at a TLS endpoint that deliberately does not exist in this harness.
// Preserve chrome-launcher's existing disabled features; production flags are unchanged.
const fixtureFeatures=Launcher.defaultFlags().find(flag=>flag.startsWith('--disable-features='))
  + ',HttpsUpgrades,HttpsFirstModeIncognito,HttpsFirstBalancedModeAutoEnable';
const collect=createLighthouseCollector({launch,lighthouse,chromium,proxy,chromePath:chromium.executablePath(),
  connectPuppeteer: options => puppeteer.connect(options),
  chromeFlags:['--headless','--no-sandbox','--disable-dev-shm-usage',fixtureFeatures]});

const runtime=express();runtime.use(express.json());
runtime.post('/analyze/runtime',(req,res,next)=>{
  if(new URL(req.body.url).pathname==='/unavailable') return res.status(503).json({error:'Synthetic collector unavailable'});
  next();
});
runtime.use(createRuntimeApp({chromium:fixtureChromium,proxy}));
const runtimeServer=runtime.listen(3016,'127.0.0.1');
const lighthouseServer=createLighthouseServer({analyze:async(url,options)=>{
  const path=new URL(url).pathname;
  if(path==='/partial') return {lhr:{categories:{performance:{score:1}},audits:{}}};
  if(path==='/empty') return {lhr:{categories:{},audits:{}}};
  if(path==='/unavailable') throw new Error('Synthetic collector unavailable');
  return collect(url,options);
}});
lighthouseServer.listen(3017,'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{runtimeServer.close();lighthouseServer.close();proxyServer.close();process.exit(0);});
console.log('Controlled headless fixture services ready');
