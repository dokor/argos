import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createLighthouseServer, createConcurrencyLimiter } from './app.mjs';

async function serverFor(t, analyze) {
  const server = createLighthouseServer({ analyze });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return 'http://127.0.0.1:' + server.address().port;
}

test('health and unknown routes never call the collector', async t => {
  const base = await serverFor(t, () => { throw new Error('Must not collect'); });
  assert.deepEqual(await (await fetch(base + '/health')).json(),
    { status: 'ok', service: 'lighthouse-service' });
  assert.equal((await fetch(base + '/unknown')).status, 404);
});

test('invalid JSON, absent/non-HTTP/credential URLs are rejected before collection', async t => {
  const base = await serverFor(t, () => { throw new Error('Must not collect'); });
  for (const body of ['{', '{}', 'null', '{"url":3}', '{"url":"file:///tmp/test"}',
    '{"url":"https://user:secret@example.test"}', '{"url":"broken"}']) {
    assert.equal((await fetch(base + '/analyze', { method: 'POST', body })).status, 400);
  }
});

test('large requests are bounded and rejected', async t => {
  const base = await serverFor(t, () => { throw new Error('Must not collect'); });
  const response = await fetch(base + '/analyze',
    { method: 'POST', body: JSON.stringify({ url: 'https://example.test', padding: 'a'.repeat(65536) }) });
  assert.equal(response.status, 413);
});

test('multi-chunk JSON is assembled and only the original LHR is returned', async t => {
  const lhr = { lighthouseVersion: '13.0.3', categories: { accessibility: { score: null } }, audits: {} };
  const base = await serverFor(t, async url => {
    assert.equal(url, 'https://example.test'); return { lhr, report: 'private collector metadata' };
  });
  const { request } = await import('node:http');
  const response = await new Promise((resolve, reject) => {
    const req = request(base + '/analyze', { method: 'POST' }, res => {
      let result = ''; res.on('data', data => { result += data; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(result) }));
    });
    req.on('error', reject);
    req.write('{"url":');
    req.end('"https://example.test"}');
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, lhr);
});

test('collector errors and empty results yield generic 500 without a score', async t => {
  for (const collector of [async () => { throw new Error('private secret'); }, async () => ({}),
    async () => ({ lhr: null })]) {
    const base = await serverFor(t, collector);
    const response = await fetch(base + '/analyze',
      { method: 'POST', body: '{"url":"https://example.test"}' });
    assert.equal(response.status, 500);
    assert.equal(await response.text(), 'Internal Error');
  }
});

test('concurrency slots are released after rejection and queued work is FIFO', async () => {
  const limit = createConcurrencyLimiter(1);
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const started = [];
  const first = limit(async () => { started.push(1); await barrier; throw new Error('fixture failure'); });
  const firstFailure = assert.rejects(first, /fixture failure/);
  const second = limit(async () => { started.push(2); return 'second'; });
  const third = limit(async () => { started.push(3); return 'third'; });
  await Promise.resolve();
  assert.deepEqual(started, [1]);
  release();
  await firstFailure;
  assert.equal(await second, 'second');
  assert.equal(await third, 'third');
  assert.deepEqual(started, [1, 2, 3]);
  assert.throws(() => createConcurrencyLimiter(0), /Invalid concurrency/);
});
