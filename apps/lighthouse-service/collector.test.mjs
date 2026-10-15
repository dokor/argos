import test from 'node:test';
import assert from 'node:assert/strict';
import { createLighthouseCollector } from './collector.mjs';

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
    connectPuppeteer: async () => ({ pages: async () => [{ url: () => 'about:blank#argos-lighthouse', on: () => {} }], disconnect: async () => {} }) });
  const controller = new AbortController();
  const result = collect('https://example.com', { signal: controller.signal, timeoutMs: 100 });
  await entered; controller.abort();
  await assert.rejects(result, /Chrome closed/);
  assert.equal(killed, 1);
});
