import assert from 'node:assert/strict';
import http from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
const runtime = process.env.TEST_SERVICE === 'runtime';
const base = `http://127.0.0.1:${runtime ? 3016 : 3017}`;
const endpoint = `${base}${runtime ? '/analyze/runtime' : '/analyze'}`;
const origin=process.env.CI_FIXTURE_ORIGIN??'http://8.8.8.8';
const scope=process.env.CI_FIXTURE_ORIGIN?{navigationOrigins:[origin]}:{};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const chromiumCount = () => readdirSync('/proc').filter(id => /^\d+$/.test(id)).filter(id => {
  try {
    const comm = readFileSync(`/proc/${id}/comm`, 'utf8');
    const stat = readFileSync(`/proc/${id}/stat`, 'utf8');
    return /chrome|chromium/i.test(comm) && !stat.slice(stat.lastIndexOf(')') + 2).startsWith('Z');
  } catch { return false; }
}).length;
const idle = async () => {
  for (let i = 0; i < 100; i++) { if (chromiumCount() === 0) return; await pause(100); }
  assert.equal(chromiumCount(), 0, 'Chrome processes remain after cleanup');
};
const post = (path, timeoutMs) => fetch(endpoint, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: `${origin}${path}`, timeoutMs, ...scope }),
  signal: AbortSignal.timeout(70000),
});
// Read fixture counters using an HTTP absolute-form request to the local proxy.
const proxyHits = () => new Promise((resolve, reject) => {
  const req = http.get({ hostname: '127.0.0.1', port: 3128,
    path: 'http://8.8.8.8/stats', headers: { host: '8.8.8.8' }, timeout: 2000 }, res => {
    let body = ''; res.on('data', chunk => body += chunk);
    res.on('end', () => { try { assert.equal(res.statusCode, 200); resolve(JSON.parse(body).slowHits); } catch (e) { reject(e); } });
  });
  req.on('timeout', () => req.destroy(new Error('Fixture stats timeout')));
  req.on('error', reject);
});
await idle();
const beforeTimeout = await proxyHits();
const started = performance.now();
// Include the actual collector startup; still prove that navigation reached the fixture.
const timeoutMs = runtime ? 8000 : 20000;
const expired = await post('/slow', timeoutMs);
assert.equal(expired.status, 504);
await expired.text();
assert.ok(performance.now() - started < timeoutMs + 10000, 'Deadline exceeded with cleanup margin');
assert.ok(await proxyHits() > beforeTimeout, 'Timeout must reach slow fixture');
await idle();
console.log('PASS timeout, slow fixture reached, no live Chrome');
const beforeDisconnect = await proxyHits();
const abort = new AbortController();
const pending = fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: origin+'/slow', timeoutMs: 45000, ...scope }), signal: abort.signal })
  .then(r => ({ response: r.status }), () => ({ disconnected: true }));
let reached = false;
try {
  for (let i = 0; i < 250; i++) { if (await proxyHits() > beforeDisconnect) { reached = true; break; } await pause(100); }
} finally { abort.abort(); }
assert.ok(reached, 'Disconnect test must reach slow fixture');
assert.equal((await pending).disconnected, true);
await idle();
console.log('PASS disconnect, no live Chrome within 10 seconds');
const recovered = await post('/', runtime ? 10000 : 40000);
assert.equal(recovered.status, 200);
const data = await recovered.json();
if (runtime) assert.equal(data.navigation.status, 'COMPLETED');
else {
  assert.equal(data.runtimeError, undefined);
  assert.equal(typeof data.categories?.accessibility?.score, 'number');
}
await idle();
console.log('PASS new analysis after cleanup');
