import test from 'node:test';
import assert from 'node:assert/strict';
import { createLighthouseCollector, lighthouseChromeFlags } from './collector.mjs';

test('HTTP collection does not silently upgrade while launcher disabled features are preserved', () => {
  const flags = lighthouseChromeFlags(['--disable-features=Translate,MediaRouter', '--disable-features=HttpsUpgrades,RenderDocument']);
  assert.equal(flags.find(flag => flag.startsWith('--disable-features=')),
    '--disable-features=Translate,MediaRouter,HttpsUpgrades,RenderDocument,HttpsFirstModeIncognito,HttpsFirstBalancedMode,HttpsFirstBalancedModeAutoEnable');
  assert.ok(flags.includes('--headless'));
  assert.equal(flags.some(flag => flag.includes('no-sandbox') || flag.includes('ignore-certificate-errors')), false);
});

test('abort kills Chrome, releases the collector and cannot double-kill during cleanup', async () => {
  let rejectAudit, started, killed = 0;
  const entered = new Promise(resolve => { started = resolve; });
  const collect = createLighthouseCollector({ launch: async () => ({ port: 1234,
    kill: async () => { killed++; rejectAudit(new Error('Chrome closed')); } }),
    lighthouse: async () => { started(); return new Promise((_resolve, reject) => { rejectAudit = reject; }); },
    chromeFlags: [], proxy: 'http://127.0.0.1:3128',
    chromium: { connectOverCDP: async () => ({ newContext: async () => ({
      route: async () => {}, routeWebSocket: async () => {}, on: () => {}, newPage: async () => ({ goto: async () => {} })
    }) }) },
    connectPuppeteer: async () => ({ pages: async () => [{ url: () => 'about:blank#argos-lighthouse', on: () => {}, bringToFront: async () => {} }], disconnect: async () => {} }) });
  const controller = new AbortController();
  const result = collect('https://example.com', { signal: controller.signal, timeoutMs: 100 });
  await entered; controller.abort();
  await assert.rejects(result, /Chrome closed/);
  assert.equal(killed, 1);
});

test('each audit starts with a fresh protected context and activates its page before collection', async () => {
  let launches = 0, contexts = 0, killed = 0, activated = 0, guarded = 0;
  const handlers = {}, logs = [];
  const protectedPage = { url: () => 'about:blank#argos-lighthouse', on: (name, handler) => { handlers[name] = handler; }, bringToFront: async () => { activated++; } };
  const collect = createLighthouseCollector({
    launch: async () => { launches++; return { port: 9222, kill: async () => { killed++; } }; },
    chromium: { connectOverCDP: async () => ({ newContext: async options => {
      contexts++;
      assert.deepEqual(options, { serviceWorkers: 'block', acceptDownloads: false });
      return { route: async () => {}, routeWebSocket: async () => {}, on: () => {},
        newCDPSession:async()=>({on:()=>{},send:async method=>{
          if(method==='Page.getFrameTree')return {frameTree:{frame:{id:'main'}}};
          if(method==='Fetch.enable')guarded=contexts;
        }}),
        newPage: async () => ({on:()=>{},goto:async()=>assert.equal(guarded,contexts,'Guard must precede navigation')}) };
    } }) },
    connectPuppeteer: async () => ({ pages: async () => [protectedPage], disconnect: async () => {} }),
    lighthouse: async (url, flags, _config, page) => {
      assert.equal(url, 'https://example.com');
      assert.equal(activated, contexts);
      assert.equal(page, protectedPage);
      for (const reason of ['net::ERR_PROXY_CONNECTION_FAILED', 'https://example.com/?secret=fixture-value'])
        handlers.requestfailed({ isNavigationRequest: () => true, failure: () => ({ errorText: reason }) });
      return { lhr: { categories: {} } };
    },
    log: (event, fields) => logs.push({ event, ...fields }),
    chromeFlags: [], proxy: 'http://127.0.0.1:3128'
  });
  await collect('https://example.com',{navigationOrigins:['https://example.com']});
  await collect('https://example.com',{navigationOrigins:['https://example.com']});
  assert.equal(launches, 2);
  assert.equal(contexts, 2);
  assert.equal(killed, 2);
  assert.deepEqual(logs.slice(0, 2), [
    { event: 'analyze.navigation_failed', reason: 'net::ERR_PROXY_CONNECTION_FAILED' },
    { event: 'analyze.navigation_failed', reason: 'NETWORK_ERROR' }
  ]);
  assert.doesNotMatch(JSON.stringify(logs), /fixture-value|example.com/);
});
