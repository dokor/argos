// Isolated integration harness. It never contacts a customer Azure account or creates GitHub issues.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { request } from 'node:https';
import { createServer } from 'node:net';
import { Readable } from 'node:stream';
import { azureJournal } from '../../clients/ci/src/azure-journal.mjs';

const root = fs.mkdtempSync(join(tmpdir(), 'argos-azurite-'));
const cert = join(root, 'cert.pem'), privateKey = join(root, 'key.pem'), data = join(root, 'data'); fs.mkdirSync(data);
const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
assert.equal(spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', privateKey, '-out', cert,
  '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' }).status, 0);
const account = 'argosfixture', accountKey = randomBytes(32), destination = { provider: 'github', origin: 'https://api.github.com', id: '42', repository: 'customer/site' };
const base = `https://${account}.blob.core.windows.net`, blob = '/private/journal.json';
const initial = { version: 1, destinationId: '42', repository: destination.repository, evidenceKey: randomBytes(32).toString('base64'),
  journal: { version: 1, revision: 'initial', destinationId: '42', records: [], budgets: [] } };
let child, container, port, lastLease;
async function freePort() { const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value; }
async function start() {
  port = await freePort();
  if (process.env.ARGOS_AZURITE_ENTRY) {
    child = spawn(process.execPath, [resolve(process.env.ARGOS_AZURITE_ENTRY), '--blobHost', '127.0.0.1', '--blobPort', String(port),
      '--cert', cert, '--key', privateKey, '--location', data, '--silent', '--disableTelemetry'], {
      env: { ...process.env, AZURITE_ACCOUNTS: account + ':' + accountKey.toString('base64') }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
  } else {
    container = 'argos-azurite-' + process.pid;
    const run = spawnSync('docker', ['run', '--rm', '--detach', '--name', container, '-p', `127.0.0.1:${port}:10000`,
      '-e', 'AZURITE_ACCOUNTS=' + account + ':' + accountKey.toString('base64'), '-v', `${root}:/fixture`,
      'mcr.microsoft.com/azure-storage/azurite:3.37.0@sha256:f9791d0a0613e93057c06ae31f7ac0c0222f0530590e67e020b0986c66a36fa6',
      'azurite-blob', '--blobHost', '0.0.0.0', '--cert', '/fixture/cert.pem', '--key', '/fixture/key.pem', '--location', '/fixture/data', '--silent', '--disableTelemetry'], { stdio: 'pipe', encoding: 'utf8' });
    assert.equal(run.status, 0, 'Pinned Azurite container must start');
  }
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try { await mappedFetch(base + '/private', { method: 'HEAD', headers: {}, redirect: 'error' }); ready = true; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Isolated TLS storage must become ready');
}
async function stop() {
  if (child) { const previous = child; child = null; await new Promise(resolve => { previous.once('exit', resolve);
    previous.send('shutdown', () => previous.disconnect()); }); }
  if (container) { spawnSync('docker', ['stop', container], { stdio: 'ignore' }); container = null; }
}
function mappedFetch(url, options) {
  const u = new URL(url); assert.equal(u.origin, base); assert.equal(options.redirect, 'error');
  if (options.headers?.['x-ms-lease-id']) lastLease = options.headers['x-ms-lease-id'];
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', servername: 'localhost', port, ca: fs.readFileSync(cert),
      path: u.pathname + u.search, method: options.method, signal: options.signal,
      headers: { ...options.headers, ...(options.body ? { 'Content-Length': Buffer.byteLength(options.body) } : {}), host: u.hostname } }, response => {
        if (process.env.ARGOS_AZURITE_DEBUG === 'true' && response.statusCode >= 400) process.stdout.write(JSON.stringify({
          method: options.method, status: response.statusCode, code: response.headers['x-ms-error-code'] }) + '\n');
        resolve(new Response(options.method === 'HEAD' || [204, 205, 304].includes(response.statusCode) ? null : Readable.toWeb(response),
          { status: response.statusCode, headers: response.headers }));
      });
    req.on('error', reject); if (options.body !== undefined && options.body !== null) req.write(options.body); req.end();
  });
}
function signature(value) { return createHmac('sha256', accountKey).update(value).digest('base64'); }
function sas(access) {
  const expiry = new Date(Date.now() + 3600000).toISOString(), version = '2023-11-03';
  const string = [access, '', expiry, `/blob/${account}${blob}`, '', '', 'https', version, 'b', '', '', '', '', '', '', ''].join('\n');
  return base + blob + '?' + new URLSearchParams({ sv: version, spr: 'https', se: expiry, sr: 'b', sp: access, sig: signature(string) });
}
async function admin(method, path, body = null, extra = {}) {
  const u = new URL(base + path), bytes = body === null ? null : JSON.stringify(body);
  const headers = { 'x-ms-date': new Date().toUTCString(), 'x-ms-version': '2023-11-03', ...extra,
    ...(bytes === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(bytes)) }) };
  const canonical = Object.entries(headers).filter(([k]) => k.startsWith('x-ms-')).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + ':' + v + '\n').join('');
  const query = [...u.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => '\n' + k.toLowerCase() + ':' + v).join('');
  const toSign = [method, '', '', headers['Content-Length'] ?? '', '', headers['Content-Type'] ?? '', '', '', headers['If-Match'] ?? '', '', '', ''].join('\n')
    + '\n' + canonical + '/' + account + u.pathname + query;
  headers.Authorization = 'SharedKey ' + account + ':' + signature(toSign);
  return mappedFetch(u.href, { method, headers, body: bytes, redirect: 'error' });
}
try {
  await start();
  assert.equal((await admin('PUT', '/private?restype=container')).status, 201, 'Fixture container provisioning');
  assert.equal((await admin('PUT', blob, initial, { 'x-ms-blob-type': 'BlockBlob' })).status, 201, 'Fixture registry provisioning');
  const options = { fetcher: mappedFetch }, store = azureJournal(sas('rw'), destination, options);
  const readOnly = azureJournal(sas('r'), destination, { ...options, readOnly: true });
  assert.equal((await readOnly.encryptionKey()).toString('base64'), initial.evidenceKey);
  await assert.rejects(readOnly.withDestinationLease(store.lockKey, () => assert.fail('Read SAS acquired a lease')), { code: 'CONFIG_INVALID' });
  let firstLease;
  await store.withDestinationLease(store.lockKey, async session => {
    const journal = await session.loadJournal(), lease = await session.assertHeld(); firstLease = lastLease;
    await assert.rejects(store.withDestinationLease(store.lockKey, () => assert.fail('Concurrent lease acquired')), { code: 'PUBLICATION_STATE_UNKNOWN' });
    const before = await admin('HEAD', blob), oldEtag = before.headers.get('etag');
    const saved = await session.saveJournal(journal, { expectedRevision: journal.revision, lease }); assert.equal(saved.committed, true);
    const stale = await admin('PUT', blob, initial, { 'x-ms-blob-type': 'BlockBlob', 'x-ms-lease-id': firstLease, 'If-Match': oldEtag });
    assert.equal(stale.status, 412, 'Azure rejects stale ETag even with the current lease');
    const broken = await admin('PUT', blob + '?comp=lease', null, { 'x-ms-lease-action': 'break', 'x-ms-lease-break-period': '0' }); assert.equal(broken.status, 202);
    await store.withDestinationLease(store.lockKey, async second => {
      await second.assertHeld();
      const late = await admin('PUT', blob, initial, { 'x-ms-blob-type': 'BlockBlob', 'x-ms-lease-id': firstLease });
      assert.equal(late.status, 412, 'Azure rejects the old generation while a new lease is active');
      await assert.rejects(session.assertHeld(), { code: 'PUBLICATION_STATE_UNKNOWN' });
    });
  });
  const persisted = await store.loadJournal(); assert.notEqual(persisted.revision, 'initial');
  await stop(); await start();
  assert.deepEqual(await azureJournal(sas('rw'), destination, options).loadJournal(), persisted, 'Registry survives real emulator process restart');
  assert.equal((await admin('PUT', '/private?restype=container&comp=acl', null, { 'x-ms-blob-public-access': 'blob' })).status, 200);
  await assert.rejects(store.loadJournal(), { code: 'DESTINATION_UNAVAILABLE' });
  assert.equal((await admin('PUT', '/private?restype=container&comp=acl')).status, 200);
  assert.equal((await admin('DELETE', blob)).status, 202);
  await assert.rejects(store.loadJournal(), { code: 'PUBLICATION_STATE_UNKNOWN' });
  if (process.env.ARGOS_VERIFY_GITHUB_TOKEN === 'true') {
    const response = await fetch('https://api.github.com/graphql', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query ArgosPublisherIdentity { viewer { login databaseId __typename } }' }) });
    const value = await response.json(); assert.equal(response.status, 200); assert.equal(value.errors, undefined);
    assert.deepEqual(value.data.viewer, { login: 'github-actions[bot]', databaseId: 41898282, __typename: 'User' });
    process.stdout.write('GitHub installation identity: PASS (read-only; no issue created)\n');
  }
  process.stdout.write('Azure journal: PASS (real TLS, read SAS, exclusive lease, ETag, stale fence, restart, privacy, missing registry)\n');
} finally {
  await stop(); fs.rmSync(root, { recursive: true, force: true });
}
