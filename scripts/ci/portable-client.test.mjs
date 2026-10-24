import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { distribution } from './build-client.mjs';
import { main, execute } from '../../clients/ci/src/client.mjs';
import { configuration } from '../../clients/ci/src/config.mjs';
import { VERSION, policy, errors } from '../../clients/ci/src/resources.mjs';
import { readTrusted, hash } from '../../clients/ci/src/evidence.mjs';
import { validResponse } from '../../clients/ci/src/contracts.mjs';
import { readJson } from '../../clients/ci/src/transport.mjs';

const id = 'a2942a5c-b63a-45cd-a88a-d02b1af5db02', time = '2026-10-18T00:00:00Z';
const env = { ARGOS_API_KEY: 'argos_ci_' + 'a'.repeat(32) + '.' + 'b'.repeat(43), ARGOS_TARGET_URL: 'https://example.com/app',
  ARGOS_REPOSITORY: 'customer/site', ARGOS_SHA: 'c'.repeat(40), ARGOS_INVOCATION: '123:1', ARGOS_PRODUCER_ID: 'control' };
const identity = { apiVersion: 1, integrationId: id, keyId: 'a'.repeat(32), scopes: ['audits:write', 'results:read', 'usage:read'], origins: ['https://example.com'] };
const preflight = { apiVersion: 1, newAccessAllowed: true, scopes: identity.scopes, targets: [{ origin: 'https://example.com', state: 'VERIFIED', authorizedForKey: true }],
  usage: { period: '2026-10', timezone: 'Europe/Paris', startsAt: time, resetsAt: '2026-11-01T00:00:00Z', used: 0, reserved: 0, limit: 30, available: 30 } };
const admitted = { apiVersion: 1, id, profileId: 'standard-v1', samples: 2, createdAt: time,
  runs: [1, 2].map(n => ({ id: String(n), sample: n, status: 'QUEUED', createdAt: time, startedAt: null, finishedAt: null, failureCode: null })) };
const go = { apiVersion: 1, kind: 'verdict-v1', admissionId: id, policyId: policy.policyId, policyFingerprint: policy.fingerprint,
  sampleCount: 2, outcome: 'GO', exitCode: 0, error: null, fingerprints: { scoring: 'a'.repeat(64), measurement: 'b'.repeat(64), scope: 'c'.repeat(64), evidence: 'd'.repeat(64) }, confirmedFindings: [] };
const error = code => { const { stage, category, messageKey, actionCode, retryable, recovery } = errors[code]; return { code, stage, category, messageKey, actionCode, retryable, recovery, retryAfterSeconds: null }; };
const failed = code => ({ ...go, outcome: 'CONTROL_FAILED', exitCode: 2, fingerprints: null, error: error(code) });
const responseError = (code, delay = null) => Response.json({ schemaVersion: 1, requestId: id, error: { ...error(code), retryAfterSeconds: delay } }, { status: errors[code].httpStatus });
function fixture({ post, lookup, verdict = go, first = null, check = preflight, identityValue = identity } = {}) {
  const calls = []; let created = false, reads = 0, posts = 0;
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname; calls.push({ path, method: options.method, intent: options.headers['Idempotency-Key'], body: options.body });
    assert.equal(new URL(url).origin, 'https://argos.lelouet.fr'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer ' + env.ARGOS_API_KEY);
    if (first) { const r = first(path, calls.length); if (r) return r; }
    if (path.endsWith('/standard-v1')) return Response.json(policy);
    if (path.endsWith('/identity')) return Response.json(identityValue);
    if (path.endsWith('/preflight')) return Response.json(check);
    if (path.includes('/by-key/')) return lookup?.(++reads) ?? (created ? Response.json(admitted) : responseError('RESOURCE_NOT_AVAILABLE'));
    if (path.endsWith('/analyses')) { created = true; return await post?.(++posts) ?? Response.json(admitted, { status: 201 }); }
    if (path.endsWith('/verdict')) return typeof verdict === 'function' ? verdict() : Response.json(verdict);
    assert.fail('Unexpected API path');
  };
  return { calls, fetcher, sleep: async () => {} };
}
function temp(t) { const root = fs.mkdtempSync(join(tmpdir(), 'argos-portable-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }

test('distribution is deterministic, self-contained, runnable outside the repository and credential-free on error', t => {
  const bytes = distribution(); assert.equal(bytes, distribution());
  const checked = fs.readFileSync(new URL('../../clients/ci/dist/argos-ci.mjs', import.meta.url), 'utf8'); assert.equal(bytes, checked);
  assert.equal(/import\.meta|from ['"]\.\./.test(bytes), false);
  const root = temp(t), path = join(root, 'argos-ci.mjs'); fs.writeFileSync(path, bytes);
  const child = spawnSync(process.execPath, [path, 'doctor', '--verbose', env.ARGOS_API_KEY], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
  assert.equal(child.status, 2); assert.equal(child.stderr, ''); assert.ok(!child.stdout.includes(env.ARGOS_API_KEY));
  assert.equal(JSON.parse(child.stdout).diagnostic.code, 'CONFIG_INVALID');
});
test('doctor only reads policy, identity and preflight; no target contact, admission, file or reservation', async t => {
  const network = fixture(), root = temp(t);
  const out = await main(['doctor'], { ...env, ARGOS_OUTPUT_DIR: join(root, 'missing') }, network);
  assert.equal(out.status, 'READY'); assert.equal(out.reservationCreated, false);
  assert.equal(network.calls.length, 3); assert.ok(network.calls.every(c => c.method === 'GET')); assert.deepEqual(fs.readdirSync(root), []);
  for (const bad of [undefined, 'password', 'Bearer ' + env.ARGOS_API_KEY]) {
    const never = fixture(); const r = await main(['doctor'], { ...env, ARGOS_API_KEY: bad }, never);
    assert.equal(r.diagnostic.code, 'AUTHENTICATION_FAILED'); assert.equal(never.calls.length, 0); assert.ok(!JSON.stringify(r).includes(env.ARGOS_API_KEY));
  }
});
test('lost POST recovers then replays the SAME key/input; no extra intention and verdict is server-authoritative', async () => {
  const network = fixture({ post: n => { if (n === 1) throw new Error('synthetic-private-465 ' + env.ARGOS_API_KEY); } });
  const out = await main(['audit'], env, network); assert.equal(out.exitCode, 0);
  const writes = network.calls.filter(c => c.method === 'POST'); assert.equal(writes.length, 2);
  assert.equal(writes[0].intent, writes[1].intent); assert.equal(writes[0].body, writes[1].body);
  assert.equal(JSON.parse(writes[0].body).samples, 2); assert.equal(network.calls.filter(c => c.path.includes('/by-key/')).length, 2);
  assert.ok(!JSON.stringify(out).includes('synthetic-private-465'));
});
test('an accepted POST with an unknown success schema is recovered read-only and never promoted to GO', async () => {
  const network = fixture({ post: () => Response.json({ ...admitted, raw: 'synthetic-private-465' }, { status: 201 }) });
  const out = await main(['audit'], env, network); assert.equal(out.exitCode, 2); assert.equal(out.diagnostic.code, 'TRANSPORT_FAILED');
  assert.equal(network.calls.filter(c => c.path.includes('/by-key/')).length, 2);
  assert.equal(network.calls.filter(c => c.method === 'POST').length, 1);
  assert.ok(!JSON.stringify(out).includes('synthetic-private-465'));
});
test('idempotence survives rerun attempts and target changes conflict rather than silently reading another input', async () => {
  const gh = { ...env, GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'customer/site', GITHUB_SHA: env.ARGOS_SHA, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'argos_control', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main' };
  assert.equal(configuration(gh, 'audit').intent, configuration({ ...gh, GITHUB_RUN_ATTEMPT: '2' }, 'audit').intent);
  const network = fixture({ lookup: () => Response.json(admitted), post: () => responseError('IDEMPOTENCY_CONFLICT') });
  const out = await main(['audit'], { ...env, ARGOS_TARGET_URL: 'https://example.com/changed' }, network);
  assert.equal(out.diagnostic.code, 'IDEMPOTENCY_CONFLICT'); assert.equal(network.calls.filter(c => c.method === 'POST').length, 1);
  const resume = fixture({ lookup: () => Response.json(admitted) }); assert.equal((await main(['resume'], env, resume)).exitCode, 0);
  assert.ok(resume.calls.every(c => c.method === 'GET'));
});
test('permanent errors are not retried, Retry-After and read retries stay bounded', async () => {
  for (const code of ['AUTHENTICATION_FAILED', 'QUOTA_EXCEEDED', 'FEATURE_NOT_AVAILABLE', 'TARGET_VERIFICATION_REQUIRED']) {
    const network = fixture({ first: () => responseError(code) }); const out = await main(['audit'], env, network);
    assert.equal(out.diagnostic.code, code); assert.equal(network.calls.length, 1);
  }
  const delays = [], network = fixture({ first: (_p, n) => n <= 2 ? responseError('RATE_LIMITED', 2) : null });
  const out = await main(['doctor'], env, { ...network, sleep: async ms => delays.push(ms) });
  assert.equal(out.exitCode, 0); assert.deepEqual(delays, [2000, 2000]);
  const long = fixture({ first: () => responseError('RATE_LIMITED', 100) });
  assert.equal((await main(['doctor'], { ...env, ARGOS_TIMEOUT_SECONDS: '1' }, long)).diagnostic.code, 'RATE_LIMITED'); assert.equal(long.calls.length, 1);
});
test('pending polls are sequential, bounded, interruptible; incomplete results never yield GO', async () => {
  let polls = 0, clock = 0; const delays = [];
  const network = fixture({ verdict: () => Response.json(++polls < 3 ? failed('WAIT_TIMEOUT') : go) });
  const out = await main(['audit'], env, { ...network, now: () => clock, sleep: async ms => { delays.push(ms); clock += ms; }, random: () => 1 });
  assert.equal(out.exitCode, 0); assert.deepEqual(delays, [5000, 5000]);
  for (const code of ['MEASUREMENT_INCOMPLETE', 'CONFIRMATION_REQUIRED', 'FINDINGS_UNCONFIRMED', 'RUN_FAILED']) {
    const r = await main(['audit'], env, fixture({ verdict: failed(code) })); assert.equal(r.exitCode, 2); assert.equal(r.diagnostic.code, code);
  }
  const pending = fixture({ verdict: failed('WAIT_TIMEOUT') });
  assert.equal((await main(['audit'], { ...env, ARGOS_TIMEOUT_SECONDS: '1' }, pending)).diagnostic.code, 'WAIT_TIMEOUT');
  const controller = new AbortController(); controller.abort(); const interrupted = fixture();
  assert.equal((await main(['audit'], env, { ...interrupted, signal: controller.signal })).diagnostic.code, 'WAIT_TIMEOUT'); assert.equal(interrupted.calls.length, 0);
});
test('malformed, hostile, oversized, redirects and unknown identities fail closed without printing payloads', async () => {
  for (const make of [() => new Response('<html>synthetic-private-465 ::error::</html>'),
    () => Response.json({ ...policy, raw: 'synthetic-private-465' }), () => Response.json({ text: 'x'.repeat(65537) }),
    () => new Response('synthetic-private-465', { status: 302, headers: { location: 'https://attacker.example' } }),
    () => new Response(Uint8Array.from([0xc3, 0x28]), { headers: { 'content-type': 'application/json' } })]) {
    const network = fixture({ first: make }); const out = await main(['doctor'], env, network);
    assert.equal(out.exitCode, 2); assert.ok(!JSON.stringify(out).includes('synthetic-private-465')); assert.equal(network.calls.length, 1);
  }
  for (const verdict of [{ ...go, admissionId: 'b2942a5c-b63a-45cd-a88a-d02b1af5db02' }, { ...go, sampleCount: 1 }, { ...go, policyFingerprint: '0'.repeat(64) }])
    assert.equal((await main(['audit'], env, fixture({ verdict }))).exitCode, 2);
});
test('private evidence is opt-in, filtered, bounded and bound to external digest and exact producer/run/attempt', async t => {
  const root = temp(t), blocked = { ...go, outcome: 'SITE_NO_GO', exitCode: 1, confirmedFindings: [{ key: 'http.security.csp', category: 'security', severity: 'critical', ticketEligible: true }] };
  const runEnv = { ...env, ARGOS_OUTPUT_DIR: root, ARGOS_EXPORT_PRIVATE: '1' };
  const out = await main(['audit'], runEnv, fixture({ verdict: blocked })); assert.equal(out.exitCode, 1); assert.equal(out.publication, 'DISABLED');
  const path = join(root, 'evidence.json'), bytes = fs.readFileSync(path); assert.equal(out.evidenceSha256, hash(bytes));
  assert.ok(!bytes.includes(Buffer.from(env.ARGOS_API_KEY))); assert.ok(!bytes.includes(Buffer.from(env.ARGOS_TARGET_URL)));
  const expected = { ...configuration(env, 'audit').provenance, digest: out.evidenceSha256 };
  assert.equal(readTrusted(path, expected).verdict.outcome, 'SITE_NO_GO');
  for (const change of [{ digest: '0'.repeat(64) }, { sha: 'd'.repeat(40) }, { invocation: '123:2' }, { producerId: 'attacker' }, { repository: 'attacker/site' }]) assert.throws(() => readTrusted(path, { ...expected, ...change }));
  const preview = await main(['publication-preview'], { ...runEnv, ARGOS_API_KEY: undefined, ARGOS_EVIDENCE_SHA256: out.evidenceSha256, ARGOS_EVIDENCE_PRODUCER: 'control' }, { fetcher: () => assert.fail('preview called Argos') });
  assert.equal(preview.exitCode, 1); assert.equal(preview.publication, 'PREVIEW'); assert.equal(preview.eligibleFindings, 1);
  assert.equal((await main(['publication-preview'], { ...runEnv, ARGOS_EVIDENCE_SHA256: '0'.repeat(64) })).exitCode, 3);
  fs.writeFileSync(path, bytes + ' '); assert.throws(() => readTrusted(path, expected));
});
test('strict export schema rejects unknown catalogue, run, category, injected strings and omitted findings is not a verdict', () => {
  const summary = { apiVersion: 1, kind: 'summary-v1', runId: '1', globalScore: 0, scoringVersion: 13, criticalCount: null, importantCount: null, completeness: 'PARTIAL', generatedAt: time, expiresAt: null };
  assert.ok(validResponse('Report', summary, '1')); assert.ok(!validResponse('Report', summary, '2'));
  assert.ok(!validResponse('Report', { ...summary, raw: 'synthetic-private-465' }, '1'));
});
test('fork/PR/MR, insecure TLS, arbitrary API override and unsafe target config cannot reach the API', async () => {
  for (const change of [{ NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { NODE_OPTIONS: '--require attacker.js' }, { ARGOS_TARGET_URL: 'https://user:secret@example.com' },
    { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }, { GITLAB_CI: 'true', CI_PIPELINE_SOURCE: 'merge_request_event' }]) {
    const network = fixture(); assert.equal((await main(['audit'], { ...env, ...change }, network)).exitCode, 2); assert.equal(network.calls.length, 0);
  }
  const network = fixture(); assert.equal((await main(['doctor'], { ...env, ARGOS_API_ORIGIN: 'https://attacker.example' }, network)).exitCode, 0);
  assert.ok(network.calls.every(c => c.method === 'GET'));
});

test('a stalled body is canceled, forbidden paths/oversized files/symlinks and expired proofs cannot be consumed', async t => {
  let canceled = false; const controller = new AbortController();
  const response = new Response(new ReadableStream({ pull() {}, cancel() { canceled = true; } }), { headers: { 'content-type': 'application/json' } });
  const reading = readJson(response, 65536, controller.signal); controller.abort(); await assert.rejects(reading); assert.equal(canceled, true);
  const root = temp(t), runEnv = { ...env, ARGOS_OUTPUT_DIR: root, ARGOS_EXPORT_PRIVATE: '1' };
  const result = await main(['audit'], runEnv, fixture()); const path = join(root, 'evidence.json');
  const expected = { ...configuration(env, 'audit').provenance, digest: result.evidenceSha256 };
  const bytes = fs.readFileSync(path), data = JSON.parse(bytes);
  const expired = Buffer.from(JSON.stringify({ ...data, expiresAt: '2000-01-01T00:00:00Z' }));
  fs.writeFileSync(path, expired); assert.throws(() => readTrusted(path, { ...expected, digest: hash(expired) }));
  fs.writeFileSync(path, 'x'.repeat(65537)); assert.throws(() => readTrusted(path, expected));
  fs.writeFileSync(path, bytes);
  if (process.platform !== 'win32') { fs.symlinkSync(path, join(root, 'link')); assert.throws(() => readTrusted(join(root, 'link'), expected));
    fs.linkSync(path, join(root, 'hardlink')); assert.throws(() => readTrusted(path, expected)); }
  assert.throws(() => readTrusted(root, expected));
});
test('doctor rejects unknown policy, missing scopes, exhausted quota and unverified targets without mutation', async () => {
  for (const check of [{ ...preflight, newAccessAllowed: false }, { ...preflight, scopes: ['usage:read'] },
    { ...preflight, targets: [{ ...preflight.targets[0], state: 'EXPIRED' }] },
    { ...preflight, usage: { ...preflight.usage, used: 30, available: 0 } }]) {
    const network = fixture({ check }); const out = await main(['doctor'], { ...env, ARGOS_LANG: 'en' }, network);
    assert.equal(out.exitCode, 2); assert.ok(network.calls.every(c => c.method === 'GET'));
    assert.ok(out.diagnostic.documentationUrl.startsWith('https://argos.lelouet.fr/en/docs/errors#'));
  }
});
test('private exports validate both schemas and expected completed run, write exclusively and never emit details', async t => {
  const root = temp(t), summary = { apiVersion: 1, kind: 'summary-v1', runId: '1', globalScore: 0, scoringVersion: 13, criticalCount: 0, importantCount: 0, completeness: 'PARTIAL', generatedAt: time, expiresAt: null };
  const details = { apiVersion: 1, kind: 'details-v1', summary, reportPath: '/api/ci/v1/runs/1/report',
    details: { version: 1, categories: [], checks: [], findings: [], omittedFindings: 5 },
    artifactPolicy: { visibility: 'private', retentionDays: 7, diagnosticRetentionDays: 1, automaticUpload: false },
    publicIssue: { title: 'Argos audit: review required', body: 'An Argos CI audit requires an authenticated review. Open Argos with your own account. Findings are available only through authenticated access.' } };
  const network = fixture({ lookup: () => Response.json({ ...admitted, runs: admitted.runs.map(r => ({ ...r, status: 'COMPLETED' })) }),
    first: p => p.endsWith('/export') ? Response.json(details) : p.endsWith('/report') ? Response.json(summary) : null });
  const out = await main(['export'], { ...env, ARGOS_EXPORT_PRIVATE: '1', ARGOS_EXPORT_RUN_ID: '1', ARGOS_OUTPUT_DIR: root }, network);
  assert.equal(out.exitCode, 0); assert.equal(out.status, 'EXPORTED'); assert.ok(network.calls.every(c => c.method === 'GET'));
  assert.equal(JSON.parse(fs.readFileSync(join(root, 'details.json'))).export.details.omittedFindings, 5);
  assert.ok(!JSON.stringify(out).includes('omittedFindings'));
  for (const changed of [{ ...details, reportPath: '/api/ci/v1/runs/2/report' }, { ...details, details: { ...details.details, checks: [{ key: 'unknown', category: 'seo', state: 'MEASURED' }] } }, { ...details, unexpected: 'synthetic-private-465' }]) assert.ok(!validResponse('Export', changed, '1'));
});
test('provider artifact consent fails closed for public repos, retained latest artifacts and forged producer traces', async () => {
  const gh = { ...env, GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'customer/site', GITHUB_SHA: env.ARGOS_SHA, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'control', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', ARGOS_GITHUB_READ_TOKEN: 'fixture-read-token-465' };
  for (const repo of [{ full_name: 'customer/site', private: false, fork: false }, { full_name: 'other/site', private: true, fork: false }, { full_name: 'customer/site', private: true, fork: true }]) {
    let calls = 0; const out = await main(['artifact-check'], gh, { fetcher: async (url, opts) => { calls++; assert.equal(url, 'https://api.github.com/repos/customer/site'); assert.equal(opts.redirect, 'error'); assert.equal(opts.headers.Authorization, 'Bearer fixture-read-token-465'); return Response.json(repo); } });
    assert.equal(out.exitCode, 2); assert.equal(calls, 1);
  }
  const gl = { ...env, GITLAB_CI: 'true', CI_PROJECT_PATH: 'customer/site', CI_PROJECT_ID: '42', CI_COMMIT_SHA: env.ARGOS_SHA, CI_PIPELINE_ID: '123', CI_JOB_ID: '789', CI_DEFAULT_BRANCH: 'main', CI_COMMIT_BRANCH: 'main', CI_COMMIT_REF_PROTECTED: 'true', CI_SERVER_URL: 'https://gitlab.com', CI_PIPELINE_SOURCE: 'push', ARGOS_GITLAB_READ_TOKEN: 'fixture-read-token-465' };
  for (const project of [{ id: 42, path_with_namespace: 'customer/site', visibility: 'public', keep_latest_artifact: false }, { id: 42, path_with_namespace: 'customer/site', visibility: 'private', keep_latest_artifact: true }]) {
    assert.equal((await main(['artifact-check'], gl, { fetcher: async () => Response.json(project) })).exitCode, 2);
  }
  const proof = await main(['publication-preview'], gl, { fetcher: async url => Response.json(url.includes('/jobs?') ? [{ id: 789, name: 'argos_control', status: 'success', pipeline: { id: 123, sha: '0'.repeat(40) } }] : { id: 42, path_with_namespace: 'customer/site', visibility: 'private', keep_latest_artifact: false }) });
  assert.equal(proof.exitCode, 3); assert.equal(proof.diagnostic.code, 'ARTIFACT_INVALID');
  const producerFailure = await main(['audit'], env, fixture({ first: () => responseError('AUTHENTICATION_FAILED') }));
  assert.equal(producerFailure.command, 'audit');
  const skip = await main(['publication-preview'], gl, { fetcher: async url => url.includes('/trace')
    ? new Response(JSON.stringify({ ...producerFailure, diagnostic: { ...producerFailure.diagnostic, message: 'synthetic-private-465' } }) + '\n', { headers: { 'content-type': 'text/plain' } })
    : Response.json(url.includes('/jobs?') ? [{ id: 789, name: 'argos_control', status: 'failed', pipeline: { id: 123, sha: env.ARGOS_SHA } }] : { id: 42, path_with_namespace: 'customer/site', visibility: 'private', keep_latest_artifact: false }) });
  assert.equal(skip.exitCode, 2); assert.equal(skip.publication, 'DISABLED'); assert.equal(skip.diagnostic.code, 'AUTHENTICATION_FAILED');
  assert.ok(!JSON.stringify(skip).includes('synthetic-private-465'));
});
