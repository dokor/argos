import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { createServer } from 'node:https';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { policy, errors } from '../../clients/ci/src/resources.mjs';

const id = 'a2942a5c-b63a-45cd-a88a-d02b1af5db02', date = '2026-10-18T00:00:00Z';
const key = 'argos_ci_' + 'a'.repeat(32) + '.' + 'b'.repeat(43);
const verdict = { apiVersion: 1, kind: 'verdict-v1', admissionId: id, policyId: policy.policyId, policyFingerprint: policy.fingerprint, sampleCount: 2,
  outcome: 'GO', exitCode: 0, error: null, fingerprints: { scoring: 'a'.repeat(64), measurement: 'b'.repeat(64), scope: 'c'.repeat(64), evidence: 'd'.repeat(64) }, confirmedFindings: [] };
const admission = { apiVersion: 1, id, profileId: 'standard-v1', samples: 2, createdAt: date,
  runs: [1, 2].map(n => ({ id: String(n), sample: n, status: 'QUEUED', createdAt: date, startedAt: null, finishedAt: null, failureCode: null })) };
const scopes = ['audits:write', 'results:read', 'usage:read'];
const missing = (() => { const { stage, category, messageKey, actionCode, retryable, recovery } = errors.RESOURCE_NOT_AVAILABLE;
  return { schemaVersion: 1, requestId: id, error: { code: 'RESOURCE_NOT_AVAILABLE', stage, category, messageKey, actionCode, retryable, recovery, retryAfterSeconds: null } }; })();

test('standalone process over real verified TLS: GitHub and GitLab contexts, lost admission response, same intent, private transfer and preview only', { timeout: 30000 }, async t => {
  const root = fs.mkdtempSync(join(tmpdir(), 'argos-client-tls-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
  const cert = join(root, 'cert.pem'), privateKey = join(root, 'key.pem');
  const created = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', privateKey, '-out', cert,
    '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
  assert.equal(created.status, 0, 'A local fixture certificate is required');
  // The test alone maps the immutable production URLs to its local TLS server. No CLI override exists.
  const preload = join(root, 'fixture.mjs');
  fs.writeFileSync(preload, `import{request}from'node:https';import{readFileSync}from'node:fs';import{Readable}from'node:stream';
globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>{const u=new URL(url);const prefix=u.origin==='https://argos.lelouet.fr'?'':u.origin==='https://gitlab.com'?'/gitlab':u.origin==='https://api.github.com'?'/github':null;
if(prefix===null||options.redirect!=='error')return reject(Error('invalid fixture destination'));
const req=request({hostname:'127.0.0.1',servername:'localhost',port:process.env.FIXTURE_PORT,path:prefix+u.pathname+u.search,method:options.method??'GET',headers:options.headers,ca:readFileSync(process.env.FIXTURE_CA),signal:options.signal},res=>resolve(new Response(Readable.toWeb(res),{status:res.statusCode,headers:res.headers})));req.on('error',reject);if(options.body)req.write(options.body);req.end();});`);
  const client = join(root, 'argos-ci.mjs'); fs.copyFileSync(new URL('../../clients/ci/dist/argos-ci.mjs', import.meta.url), client);
  let intents = new Map(), posts = 0, credits = 0, trace = '', blocked = false, lost = false; const paths = [];
  const server = createServer({ key: fs.readFileSync(privateKey), cert: fs.readFileSync(cert) }, async (req, res) => {
    paths.push(req.url); res.setHeader('content-type', 'application/json');
    const send = (value, status = 200) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (req.url.startsWith('/gitlab/')) {
      assert.equal(req.headers.authorization, undefined); assert.equal(req.headers['private-token'], 'fixture-read-token-465');
      if (req.url.includes('/trace')) { res.setHeader('content-type', 'text/plain; charset=utf-8'); res.end(trace); return; }
      if (req.url.includes('/jobs?')) return send([{ id: 789, name: 'argos_control', status: 'failed', pipeline: { id: 123, sha: 'c'.repeat(40) } }]);
      return send({ id: 42, path_with_namespace: 'customer/site', visibility: 'private', keep_latest_artifact: false });
    }
    assert.equal(req.headers.authorization, 'Bearer ' + key); assert.equal(req.headers['private-token'], undefined);
    if (req.url.endsWith('/standard-v1')) return send(policy);
    if (req.url.endsWith('/identity')) return send({ apiVersion: 1, integrationId: id, keyId: 'a'.repeat(32), scopes, origins: ['https://example.com'] });
    if (req.url.endsWith('/preflight')) return send({ apiVersion: 1, newAccessAllowed: true, scopes, targets: [{ origin: 'https://example.com', state: 'VERIFIED', authorizedForKey: true }],
      usage: { period: '2026-10', timezone: 'UTC', startsAt: date, resetsAt: '2026-11-01T00:00:00Z', used: 0, reserved: 0, limit: 30, available: 30 } });
    if (req.url.includes('/by-key/')) return send(intents.get(req.url.split('/').at(-1)) ?? missing, intents.has(req.url.split('/').at(-1)) ? 200 : 404);
    if (req.url.endsWith('/analyses')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks)); assert.equal(input.url, 'https://example.com/app'); assert.equal(input.samples, 2);
      posts++; const intent = req.headers['idempotency-key']; if (!intents.has(intent)) { credits += 2; intents.set(intent, admission); }
      if (!lost) { lost = true; req.socket.destroy(); return; } return send(admission, 200);
    }
    if (req.url.endsWith('/verdict')) return send(blocked ? { ...verdict, outcome: 'SITE_NO_GO', exitCode: 1,
      confirmedFindings: [{ key: 'http.security.csp', category: 'security', severity: 'critical', ticketEligible: true }] } : verdict);
    assert.fail('Unexpected network endpoint');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const common = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, FIXTURE_PORT: String(server.address().port), FIXTURE_CA: cert,
    ARGOS_API_KEY: key, ARGOS_TARGET_URL: 'https://example.com/app', ARGOS_EXPORT_PRIVATE: '1', ARGOS_TIMEOUT_SECONDS: '20' };
  async function run(command, extra) {
    const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, client, command], { cwd: root, env: { ...common, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
    assert.equal(stderr, ''); assert.equal(stdout.includes(key), false); assert.equal(stdout.includes('https://example.com'), false);
    return { code, row: JSON.parse(stdout), stdout };
  }
  const github = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'customer/site', GITHUB_SHA: 'c'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'argos_control', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', ARGOS_OUTPUT_DIR: join(root, 'github') };
  const gh = await run('audit', github); assert.equal(gh.code, 0); assert.equal(credits, 2); assert.equal(posts, 2);
  const preview = await run('publication-preview', { ...github, GITHUB_JOB: 'argos_preview', ARGOS_API_KEY: '', ARGOS_EVIDENCE_SHA256: gh.row.evidenceSha256, ARGOS_EVIDENCE_PRODUCER: 'argos_control' });
  assert.equal(preview.row.publication, 'PREVIEW'); assert.equal(preview.code, 0);
  intents = new Map(); blocked = true; lost = true; const before = credits;
  const gitlab = { GITLAB_CI: 'true', CI_PROJECT_PATH: 'customer/site', CI_PROJECT_ID: '42', CI_COMMIT_SHA: 'c'.repeat(40), CI_PIPELINE_ID: '123', CI_JOB_ID: '789', CI_DEFAULT_BRANCH: 'main', CI_COMMIT_BRANCH: 'main', CI_COMMIT_REF_PROTECTED: 'true', CI_SERVER_URL: 'https://gitlab.com', CI_PIPELINE_SOURCE: 'push', ARGOS_OUTPUT_DIR: join(root, 'gitlab') };
  const gl = await run('audit', gitlab); assert.equal(gl.code, 1); assert.equal(credits - before, 2); trace = gl.stdout;
  const glPreview = await run('publication-preview', { ...gitlab, CI_JOB_ID: '790', ARGOS_API_KEY: '', ARGOS_GITLAB_READ_TOKEN: 'fixture-read-token-465' });
  assert.equal(glPreview.row.publication, 'PREVIEW'); assert.equal(glPreview.code, 1);
  assert.ok(paths.every(p => p.startsWith('/api/ci/v1/') || p.startsWith('/gitlab/api/v4/projects/42')));
});
