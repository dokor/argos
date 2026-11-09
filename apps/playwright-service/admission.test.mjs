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

for (const cause of ['deadline', 'disconnect']) {
  test(`${cause} holds admission through cleanup and allows a subsequent analysis`, { timeout: 10000 }, async t => {
    let navigationStarted, rejectNavigation, cleanupStarted, releaseCleanup;
    const navigating = new Promise(resolve => { navigationStarted = resolve; });
    const cleaning = new Promise(resolve => { cleanupStarted = resolve; });
    const cleanup = new Promise(resolve => { releaseCleanup = resolve; });
    let launches = 0;
    const base = await start(t, { proxy: 'http://127.0.0.1:3128', maxConcurrency: 1, chromium: {
      launch: async () => {
        const first = ++launches === 1;
        const page = { on: () => {}, url: () => 'https://example.com', waitForTimeout: async () => {},
          goto: async () => {
            if (first) await new Promise((_resolve, reject) => {
              rejectNavigation = reject; navigationStarted();
            });
          } };
        return {
          newContext: async () => ({ route: async () => {}, routeWebSocket: async () => {},
            on: () => {}, newPage: async () => page }),
          close: async () => {
            if (!first) return;
            cleanupStarted();
            rejectNavigation?.(new Error('Browser closed'));
            await cleanup;
          }
        };
      }
    } });
    const abort = new AbortController();
    t.after(() => { abort.abort(); releaseCleanup(); });
    const pending = fetch(base + '/analyze/runtime', { method: 'POST', signal: abort.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', timeoutMs: cause === 'deadline' ? 100 : 45000 })
    }).then(response => response.status, () => 'disconnected');
    await navigating;
    if (cause === 'disconnect') abort.abort();
    await cleaning;
    assert.equal((await request(base)).status, 429);
    assert.equal(launches, 1);
    releaseCleanup();
    assert.equal(await pending, cause === 'deadline' ? 504 : 'disconnected');
    // Disconnect has no response to synchronize on: wait for handler cleanup to settle.
    let recovered;
    for (let attempt = 0; attempt < 50; attempt++) {
      recovered = await request(base);
      if (recovered.status !== 429) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(recovered.status, 200);
    assert.equal(launches, 2);
  });
}
