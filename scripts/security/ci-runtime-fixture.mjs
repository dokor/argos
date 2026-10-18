// Fixture-only trust store; run the unchanged production HTTP service afterwards.
import { mkdirSync,cpSync } from 'node:fs';
import { join } from 'node:path';
const location=join(process.env.HOME,'.pki','nssdb');
mkdirSync(location,{recursive:true});cpSync('/fixture-nssdb',location,{recursive:true});
// Fixed names/statuses only, from isolated fixtures: identify protocol stalls
// without printing target URLs, headers or protocol payloads.
const {chromium}=await import('/app/node_modules/playwright/index.mjs');
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
  const browser=await launch(options),create=browser.newContext.bind(browser);
  browser.newContext=async options=>{
    const context=await create(options),session=context.newCDPSession.bind(context);
    context.newCDPSession=async page=>{
      const cdp=await session(page),send=cdp.send.bind(cdp);
      cdp.send=async(method,args)=>{console.log('FIXTURE CDP start '+method);try{const result=await send(method,args);console.log('FIXTURE CDP done '+method);return result;}catch(error){console.log('FIXTURE CDP rejected '+method);throw error;}};
      cdp.on('Fetch.requestPaused',event=>console.log('FIXTURE response pause '+(event.responseStatusCode??'request')));
      return cdp;
    };return context;
  };return browser;
};
await import('/app/server.mjs');
