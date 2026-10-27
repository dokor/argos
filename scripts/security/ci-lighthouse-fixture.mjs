// Fixture bootstrap only: install the ephemeral CA's public NSS database in the
// supervisor's fresh HOME, then run the actual production worker unchanged.
// This file is mounted by docker-smoke, never copied into a production image.
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
if(typeof process.send==='function') {
  const location=join(process.env.HOME,'.pki','nssdb');mkdirSync(location,{recursive:true});
  cpSync('/fixture-nssdb',location,{recursive:true});
  await import('/app/worker.mjs');
}else {
  const {createLighthouseServer}=await import('/app/app.mjs');
  const {createSupervisedCollector}=await import('/app/supervisor.mjs');
  const analyze=createSupervisedCollector({workerFile:new URL(import.meta.url)});
  const server=createLighthouseServer({analyze,maxConcurrency:1});
  server.requestTimeout=10000;server.headersTimeout=10000;server.maxConnections=32;
  server.listen(3017);
}
