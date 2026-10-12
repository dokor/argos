import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRuntimeApp } from './app.mjs';

const request = base => fetch(base+'/analyze/runtime',{method:'POST',headers:{'content-type':'application/json'},body:'{"url":"https://example.com"}'});
async function start(t, options){const server=createRuntimeApp(options).listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));return 'http://127.0.0.1:'+server.address().port;}
test('missing proxy and private direct requests never launch a browser',async t=>{
  let launches=0;const base=await start(t,{proxy:'',chromium:{launch:async()=>launches++}});
  assert.equal((await request(base)).status,503);
  assert.equal((await fetch(base+'/analyze/runtime',{method:'POST',headers:{'content-type':'application/json'},body:'{"url":"http://127.0.0.1"}'})).status,400);
  assert.equal(launches,0);
});
test('runtime saturation rejects immediately and releases every launch slot on error',async t=>{
  let release, entered, launches=0;const barrier=new Promise(resolve=>{release=resolve;});
  const started=new Promise(resolve=>{entered=resolve;});
  const base=await start(t,{proxy:'http://127.0.0.1:3128',maxConcurrency:2,chromium:{launch:async()=>{
    launches++;if(launches===2)entered();await barrier;throw new Error('Synthetic launch failure');}}});
  const first=request(base),second=request(base);await started;
  assert.equal((await request(base)).status,429);assert.equal(launches,2);
  release();assert.equal((await first).status,500);assert.equal((await second).status,500);
  assert.equal((await request(base)).status,500);assert.equal(launches,3);
});
