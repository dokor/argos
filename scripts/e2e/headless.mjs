// Dedicated fixture harness; production entry points never enable these degraded responses.
import express from '../../apps/playwright-service/node_modules/express/index.js';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import lighthouse from '../../apps/lighthouse-service/node_modules/lighthouse/core/index.js';
import { launch } from '../../apps/lighthouse-service/node_modules/chrome-launcher/dist/index.js';
import { createRuntimeApp } from '../../apps/playwright-service/app.mjs';
import { createLighthouseServer } from '../../apps/lighthouse-service/app.mjs';

const runtime=express();runtime.use(express.json());
runtime.post('/analyze/runtime',(req,res,next)=>{
  if(new URL(req.body.url).pathname==='/unavailable') return res.status(503).json({error:'Synthetic collector unavailable'});
  next();
});
runtime.use(createRuntimeApp({chromium}));
const runtimeServer=runtime.listen(3016,'127.0.0.1');
const lighthouseServer=createLighthouseServer({analyze:async(url)=>{
  const path=new URL(url).pathname;
  if(path==='/partial') return {lhr:{categories:{performance:{score:1}},audits:{}}};
  if(path==='/empty') return {lhr:{categories:{},audits:{}}};
  if(path==='/unavailable') throw new Error('Synthetic collector unavailable');
  const chrome=await launch({chromePath:chromium.executablePath(),chromeFlags:['--headless','--no-sandbox','--disable-dev-shm-usage']});
  try{return await lighthouse(url,{port:chrome.port,output:'json',logLevel:'error',locale:'fr',maxWaitForLoad:10000});}
  finally {await chrome.kill();}
}});
lighthouseServer.listen(3017,'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{runtimeServer.close();lighthouseServer.close();process.exit(0);});
console.log('Controlled headless fixture services ready');
