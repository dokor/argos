import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRuntimeApp } from './app.mjs';

async function serverFor(t, chromium) {
  const server = createRuntimeApp({ chromium }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return 'http://127.0.0.1:' + server.address().port;
}
function collector({ navigationFailure = false, contextFailure = false } = {}) {
  let closed = 0, launched = 0;
  const handlers = {};
  const page = {
    on: (name, handler) => { handlers[name] = handler; },
    url: () => 'https://www.example.co.uk/final',
    goto: async () => {
      handlers.console({ type: () => 'error', text: () => 'fixture',
        location: () => ({ url: 'https://assets.example.co.uk/script.js' }) });
      handlers.console({ type: () => 'error', text: () => 'third party',
        location: () => ({ url: 'https://other.test/script.js' }) });
      handlers.pageerror(new Error('fixture page error'));
      handlers.request({ url: () => 'https://assets.example.co.uk/script.js',
        resourceType: () => 'script', method: () => 'GET' });
      handlers.requestfailed({ url: () => 'https://assets.example.co.uk/script.js' });
      await handlers.response({ url: () => 'https://other.test/api', status: () => 503,
        headers: () => ({ 'content-length': '321' }) });
      if (navigationFailure) throw new Error('Timeout fixture');
    },
    waitForLoadState: async () => {},
    waitForTimeout: async () => {}
  };
  const chromium = { launch: async () => {
    launched++;
    return {
      newContext: async () => {
        if (contextFailure) throw new Error('private context failure');
        return { newPage: async () => page };
      },
      close: async () => { closed++; }
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
  for (const body of ['{}', 'null', '{"url":3}', '{"url":"ftp://example.test"}',
    '{"url":"https://user:secret@example.test"}', '{']) {
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
  assert.equal(report.finalUrl, 'https://www.example.co.uk/final');
  assert.equal(report.console.errors, 2);
  assert.equal(report.console.errorsFirstParty, 1);
  assert.equal(report.jsErrors.count, 1);
  assert.equal(report.network.requests, 1);
  assert.equal(report.network.failedRequestsFirstParty, 1);
  assert.equal(report.network.failedRequestsThirdParty, 0);
  assert.equal(report.network.status5xxFirstParty, 0);
  assert.equal(report.network.status5xxThirdParty, 1);
  assert.equal(report.network.totalBytesEstimated, 321);
  assert.equal(fake.closed(), 1);
});

test('navigation timeout returns partial observations and closes the browser', async t => {
  const fake = collector({ navigationFailure: true });
  const response = await analyze(await serverFor(t, fake.chromium));
  const report = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(report.timings, { domContentLoadedMs: null, loadMs: null });
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
