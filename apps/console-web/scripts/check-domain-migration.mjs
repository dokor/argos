// Run after npm run build. All requests stay on loopback; redirects are never followed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: new URL('..', import.meta.url), windowsHide: true,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', data => { output = (output + data).slice(-12000); });
const stopped = new Promise(resolve => server.once('exit', resolve));
// Use node:http: fetch may normalize the Host header to its connection URL.
const request = (path, host, init = {}) => new Promise((resolve, reject) => {
  const req = httpRequest(origin + path, {
    method: init.method ?? 'GET', headers: { ...init.headers, Host: host },
    signal: AbortSignal.timeout(15000),
  }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('error', reject);
    response.on('end', () => {
      const headers = new Headers();
      for (const [name, values] of Object.entries(response.headers)) {
        for (const value of Array.isArray(values) ? values : [values]) {
          if (value !== undefined) headers.append(name, value);
        }
      }
      resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers }));
    });
  });
  req.on('error', reject);
  req.end(init.body);
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('Next.js exited before readiness');
    try { ready = (await request('/robots.txt', 'argos-audit.com')).ok; } catch { /* Starting. */ }
    if (ready) break;
    await delay(500);
  }
  assert.ok(ready, 'Next.js did not become ready');
  let checked = 0;
  for (const host of ['argos.lelouet.fr', 'www.argos-audit.com']) {
    for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      for (const path of ['/', '/en/faq', '/de/faq', '/es/resources/digital-accessibility', '/report/synthetic-token?view=summary',
        '/faq?utm_source=legacy&tag=one&tag=two', '/guides/caf%C3%A9?next=%2Ffaq%3Fx%3D1',
        '/api/audits?scope=page', '/api/account/auth/oauth/google/callback?code=synthetic&state=synthetic',
        '/sitemap.xml', '/robots.txt', '/og.png']) {
        const response = await request(path, host, { method,
          ...(['POST', 'PUT', 'PATCH'].includes(method) ? { body: '{"synthetic":true}', headers: { 'Content-Type': 'application/json' } } : {}),
        });
        assert.equal(response.status, 308, `${method} ${host}${path}`);
        assert.equal(new URL(response.headers.get('location')).href, new URL('https://argos-audit.com' + path).href);
        await response.arrayBuffer();
        checked++;
      }
    }
    const response = await request('/accessibilite-numerique?source=old', host);
    assert.equal(response.headers.get('location'), 'https://argos-audit.com/ressources/accessibilite-numerique?source=old');
  }
  for (const host of ['argos-audit.com', 'localhost', 'argos.lelouet.fr.attacker.example']) {
    const response = await request('/faq', host);
    assert.equal(response.status, 200, host);
    assert.equal(response.headers.get('location'), null);
    const html = await response.text();
    assert.match(html, /rel="canonical" href="https:\/\/argos-audit\.com\/faq"/);
    assert.ok(!html.includes('https://argos.lelouet.fr'), 'Legacy URL leaked into rendered metadata');
  }
  for (const [path, canonical] of [['/', 'https://argos-audit.com'], ['/en', 'https://argos-audit.com/en'],
    ['/de', 'https://argos-audit.com/de'], ['/de/faq', 'https://argos-audit.com/de/faq'],
    ['/es/faq', 'https://argos-audit.com/es/faq'],
    ['/guides/refonte-site-web', 'https://argos-audit.com/guides/refonte-site-web']]) {
    const response = await request(path, 'argos-audit.com');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(`rel="canonical" href="${canonical}"`));
    assert.ok(!html.includes('https://argos.lelouet.fr'));
    assert.match(html, /application\/ld\+json/);
  }
  const sitemap = await (await request('/sitemap.xml', 'argos-audit.com')).text();
  assert.match(sitemap, /https:\/\/argos-audit\.com\/en/);
  assert.ok(!sitemap.includes('argos.lelouet.fr') && !sitemap.includes('/account/') && !sitemap.includes('/report/'));
  const robots = await (await request('/robots.txt', 'argos-audit.com')).text();
  assert.match(robots, /Sitemap: https:\/\/argos-audit\.com\/sitemap.xml/);
  for (const path of ['/report/synthetic-token', '/en/report/synthetic-token', '/account/sign-in', '/de/account/sign-in', '/es/report/synthetic-token']) {
    const response = await request(path, 'argos-audit.com');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    await response.arrayBuffer();
  }
  console.log(`Domain migration HTTP checks passed: ${checked} redirects, canonical HTML, JSON-LD, sitemap, robots and private noindex.`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  server.kill();
  await stopped;
}
