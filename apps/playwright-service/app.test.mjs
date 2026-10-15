import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRuntimeApp } from './app.mjs';

async function serverFor(t, chromium) {
  const server = createRuntimeApp({ chromium, proxy: 'http://127.0.0.1:3128' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return 'http://127.0.0.1:' + server.address().port;
}
function collector({ navigationFailure = false, contextFailure = false, cdpFailure = null,
  jsCount = 1, contentLength = '321', failureCount = 1, finalUrl = 'https://www.example.co.uk/final' } = {}) {
  let closed = 0, launched = 0;
  const handlers = {};
  const contextHandlers = {};
  let rejectInstrumentation;
  const page = {
    on: (name, handler) => { handlers[name] = handler; },
    url: () => finalUrl,
    goto: async () => {
      handlers.console({ type: () => 'error', text: () => 'fixture',
        location: () => ({ url: 'https://assets.example.co.uk/script.js' }) });
      handlers.console({ type: () => 'error', text: () => 'third party',
        location: () => ({ url: 'https://other.test/script.js' }) });
      if (finalUrl.startsWith('https://other.test/')) handlers.console({ type: () => 'error',
        location: () => ({ url: 'https://other.test/second.js' }) });
      for (let i = 0; i < jsCount; i++) handlers.pageerror(new Error('fixture page error'));
      handlers.request({ url: () => 'https://assets.example.co.uk/script.js',
        resourceType: () => 'script', method: () => 'GET' });
      for (let i = 0; i < failureCount; i++) handlers.requestfailed({ url: () => 'https://assets.example.co.uk/script.js?token=private-secret', resourceType: () => 'script', failure: () => ({errorText:'net::ERR_CONNECTION_RESET'}) });
      await handlers.response({ url: () => 'https://other.test/api', status: () => 503,
        headers: () => ({ 'content-length': contentLength }) });
      if (navigationFailure) throw new Error('Timeout fixture');
      handlers.domcontentloaded();
      await new Promise(resolve => setTimeout(resolve, 15));
      handlers.load();
    },
    waitForLoadState: async () => {},
    waitForTimeout: async () => {}
  };
  const chromium = { launch: async () => {
    launched++;
    return {
      newContext: async () => {
        if (contextFailure) throw new Error('private context failure');
        return {
          route: async () => {}, routeWebSocket: async () => {},
          on: (name, handler) => { contextHandlers[name] = handler; },
          newCDPSession: async () => {
            if (cdpFailure === 'active') throw new Error('Instrumentation unavailable');
            return { send: () => new Promise((_resolve, reject) => { rejectInstrumentation = reject; }) };
          },
          newPage: async () => {
            if (cdpFailure) void contextHandlers.page(page);
            return page;
          }
        };
      },
      close: async () => {
        closed++;
        if (rejectInstrumentation) {
          rejectInstrumentation(new Error('Target closed'));
          await new Promise(resolve => setImmediate(resolve));
        }
      }
    };
  } };
  return { chromium, closed: () => closed, launched: () => launched };
}
async function analyze(base) {
  return fetch(base + '/analyze/runtime', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: '{"url":"https://example.co.uk"}' });
}

test('health and invalid inputs never launch Chromium', async t => {
  let launches = 0;
  const base = await serverFor(t, { launch: async () => { launches++; throw new Error('Must not launch'); } });
  assert.deepEqual(await (await fetch(base + '/health')).json(),
    { status: 'ok', service: 'playwright-service' });
  assert.equal((await fetch(base + '/unknown')).status, 404);
  for (const body of ['{}', 'null', '{"url":3}', '{"url":"ftp://example.com"}',
    '{"url":"https://user:secret@example.com"}', '{']) {
    assert.equal((await fetch(base + '/analyze/runtime', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body })).status, 400);
  }
  assert.equal(launches, 0);
});

test('runtime contract retains metrics and partitions errors using the final domain', async t => {
  const fake = collector();
  const base = await serverFor(t, fake.chromium);
  const response = await analyze(base);
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.url, 'https://example.co.uk');
  assert.equal(report.finalUrl, 'https://www.example.co.uk');
  assert.deepEqual(report.navigation, { status: 'COMPLETED', reason: null });
  assert.equal(report.console.errors, 2);
  assert.equal(report.console.errorsFirstParty, 1);
  assert.equal(report.jsErrors.count, 1);
  assert.equal(report.network.requests, 1);
  assert.equal(report.network.failedRequestsFirstParty, 1);
  assert.equal(report.network.failedRequestsThirdParty, 0);
  assert.equal(report.network.status5xxFirstParty, 0);
  assert.equal(report.network.status5xxThirdParty, 1);
  assert.equal(report.network.totalBytesEstimated, 321);
  assert.ok(report.timings.loadMs > report.timings.domContentLoadedMs);
  const evidence=report.network.observedEvidence;
  assert.equal(evidence.version,'observed-evidence-v1');
  assert.equal(evidence.items[0].ownership,'FIRST_PARTY');
  assert.equal(evidence.items[0].reason,'net::ERR_CONNECTION_RESET');
  assert.equal(evidence.items[1].ownership,'THIRD_PARTY');
  assert.equal(evidence.items[1].status,503);
  assert.doesNotMatch(JSON.stringify(evidence),/private-secret|script.js|\?token/);
  assert.equal(fake.closed(), 1);
});

test('sample caps never cap the JS count or fabricate complete network totals', async t => {
  const fake = collector({ jsCount: 37, failureCount: 301, contentLength: undefined });
  // Explicit empty header models chunked/compressed responses without Content-Length.
  const unknownBytes = collector({ contentLength: '' });
  const report = await (await analyze(await serverFor(t, fake.chromium))).json();
  assert.equal(report.jsErrors.count, 37);
  assert.equal(report.jsErrors.samples.length, 10);
  assert.equal(report.network.failedRequests, null);
  assert.equal(report.network.failedRequestsFirstParty, null);
  const unknown = await (await analyze(await serverFor(t, unknownBytes.chromium))).json();
  assert.equal(unknown.network.totalBytesEstimated, null);
});

test('console ownership follows a redirect to another registrable domain', async t => {
  const fake = collector({ finalUrl: 'https://other.test/final' });
  const report = await (await analyze(await serverFor(t, fake.chromium))).json();
  assert.equal(report.console.errors, 3);
  assert.equal(report.console.errorsFirstParty, 2);
  assert.equal(report.network.failedRequestsFirstParty, 0);
  assert.equal(report.network.status5xxFirstParty, 1);
});

test('navigation timeout returns partial observations and closes the browser', async t => {
  const fake = collector({ navigationFailure: true });
  const response = await analyze(await serverFor(t, fake.chromium));
  const report = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(report.timings, { domContentLoadedMs: null, loadMs: null });
  assert.deepEqual(report.navigation, { status: 'FAILED', reason: 'NAVIGATION_ERROR' });
  assert.equal(report.console.errors, 2);
  assert.equal(report.jsErrors.count, 1);
  assert.equal(report.network.failedRequestsFirstParty, 1);
  assert.equal(fake.closed(), 1);
});

test('context and launch failures return a generic error and release acquired browsers', async t => {
  const fake = collector({ contextFailure: true });
  const response = await analyze(await serverFor(t, fake.chromium));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Internal Error' });
  assert.equal(fake.closed(), 1);
  const failed = await analyze(await serverFor(t, { launch: async () => { throw new Error('secret'); } }));
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: 'Internal Error' });
});
test('global request timeout closes the active browser rather than leaving navigation running', async t => {
  let rejectNavigation, closed = 0;
  const page = { on: () => {}, url: () => 'https://example.com',
    goto: () => new Promise((_resolve, reject) => { rejectNavigation = reject; }) };
  const base = await serverFor(t, { launch: async () => ({
    newContext: async () => ({ route: async () => {}, routeWebSocket: async () => {}, on: () => {}, newPage: async () => page }),
    close: async () => { closed++; rejectNavigation?.(new Error('Browser closed')); }
  }) });
  const response = await fetch(base + '/analyze/runtime', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com', timeoutMs: 100 }) });
  assert.equal(response.status, 504); assert.ok(closed >= 1);
});

for (const navigationFailure of [false, true]) {
  test(`closing a browser with pending CDP setup preserves ${navigationFailure ? 'failed' : 'completed'} navigation`, async t => {
    const fake = collector({ navigationFailure, cdpFailure: 'cleanup' });
    const response = await analyze(await serverFor(t, fake.chromium));
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.deepEqual(report.navigation, navigationFailure
      ? { status: 'FAILED', reason: 'NAVIGATION_ERROR' }
      : { status: 'COMPLETED', reason: null });
    assert.equal(report.console.errors, 2);
    assert.equal(fake.closed(), 1);
  });
}

test('CDP setup failures during collection still cancel the analysis', async t => {
  const fake = collector({ cdpFailure: 'active' });
  const response = await analyze(await serverFor(t, fake.chromium));
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: 'Analysis timeout' });
  assert.ok(fake.closed() >= 1);
});
