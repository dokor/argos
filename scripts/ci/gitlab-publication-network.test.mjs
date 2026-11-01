import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:https';
import { pathToFileURL } from 'node:url';
import { fixture, clock, readToken, writeToken } from './fixtures/gitlab-publication.mjs';
import { VERSION } from '../../clients/ci/src/resources.mjs';

test('standalone GitLab publisher over verified TLS: read-only seal, external API/trace proof, encrypted transfer and retry without another POST', { timeout: 30000 }, async t => {
  const f = fixture(t), cert = join(f.root, 'cert.pem'), key = join(f.root, 'key.pem');
  const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
  assert.equal(spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' }).status, 0);
  const server = createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, async (req, res) => {
    const prefix = req.url.startsWith('/gitlab/') ? '/gitlab' : req.url.startsWith('/azure/') ? '/azure' : null;
    if (!prefix) { res.statusCode = 400; res.end(); return; }
    const origin = prefix === '/gitlab' ? 'https://gitlab.com' : 'https://argosfixture.blob.core.windows.net';
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const result = await f.fetcher(origin + req.url.slice(prefix.length), { method: req.method, headers: req.headers,
      ...(chunks.length ? { body: Buffer.concat(chunks).toString('utf8') } : {}), redirect: 'error', cache: 'no-store' });
    res.statusCode = result.status; for (const [k, v] of result.headers) res.setHeader(k, v);
    res.end(Buffer.from(await result.arrayBuffer()));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const preload = join(f.root, 'test-only-tls.mjs'), client = join(f.root, 'argos-ci.mjs');
  // The production client has no endpoint/clock override. Only this explicit test preload maps TLS.
  fs.writeFileSync(preload, `import { request } from 'node:https'; import { readFileSync } from 'node:fs'; import { Readable } from 'node:stream';
Date.now = () => ${clock};
globalThis.fetch = (value, options) => new Promise((resolve, reject) => {
  const url = new URL(value); const prefix = url.origin === 'https://gitlab.com' ? '/gitlab' : url.origin === 'https://argosfixture.blob.core.windows.net' ? '/azure' : null;
  if(!prefix || options.redirect !== 'error') return reject(Error('Fixture origin rejected'));
  const req = request({hostname:'127.0.0.1', servername:'localhost', agent:false, port:process.env.FIXTURE_PORT, ca:readFileSync(process.env.FIXTURE_CA),
    path:prefix+url.pathname+url.search, method:options.method, signal:options.signal,
    headers:{...options.headers,...(options.body ? {'content-length':Buffer.byteLength(options.body)} : {})}},
    res=>resolve(new Response(options.method==='HEAD'?null:Readable.toWeb(res),{status:res.statusCode,headers:res.headers})));
  req.on('error',reject); if(options.body)req.write(options.body); req.end();
});`);
  fs.copyFileSync(new URL('../../clients/ci/dist/argos-ci.mjs', import.meta.url), client);
  async function run(command, extra = {}) {
    const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, client, command], {
      cwd: f.root, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...f.env,
        FIXTURE_PORT: String(server.address().port), FIXTURE_CA: cert, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = ''; child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
    assert.equal(stderr, ''); assert.doesNotMatch(stdout, /glpat-|sig=|synthetic-private|http.security/);
    return { exitCode, row: JSON.parse(stdout), stdout };
  }
  const sealed = await run('publication-stage'); assert.equal(sealed.exitCode, 0); assert.equal(sealed.row.proofStaged, true);
  assert.ok(f.state.calls.every(c => ['GET', 'HEAD'].includes(c.method)));
  f.state.trace = JSON.stringify({ clientVersion: VERSION, command: 'audit', auditOutcome: 'GO', auditExitCode: 0, exitCode: 0,
    evidenceSha256: f.env.ARGOS_EVIDENCE_SHA256 }) + '\n' + sealed.stdout;
  fs.copyFileSync(join(f.root, 'control/evidence.enc.json'), join(f.root, 'publisher/evidence.enc.json'));
  const publisher = { CI_JOB_ID: '790', CI_JOB_NAME: 'argos_publish', ARGOS_OUTPUT_DIR: join(f.root, 'publisher'),
    ARGOS_GITLAB_PUBLISH_TOKEN: writeToken, ARGOS_GITLAB_READ_TOKEN: readToken,
    ARGOS_GITLAB_JOURNAL_SAS_URL: f.env.ARGOS_GITLAB_JOURNAL_READ_SAS_URL.replace('sp=r&', 'sp=rw&') };
  const first = await run('publish-gitlab', publisher); assert.equal(first.exitCode, 0); assert.equal(first.row.counts.created, 1);
  const again = await run('publish-gitlab', { ...publisher, CI_JOB_ID: '791' }); assert.equal(again.exitCode, 0); assert.equal(again.row.counts.unchanged, 1);
  assert.equal(f.state.attempts, 1); assert.equal(f.state.issues[0].confidential, true); assert.equal(f.state.lease, null);
});
