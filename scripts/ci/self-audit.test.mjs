import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { SITE, POLICY, SERVICES, CHECKS, ControlError, analysisKey, evaluateReports,
  ticketInput, ticketMarker, normalizeServices, parseServices } from './self-audit-policy.mjs';
import { accountClient, collectAudit, deploymentSnapshot } from './self-audit.mjs';
import { githubApi, synchronizeTickets, ticketBody } from './self-audit-tickets.mjs';

const sha = 'a'.repeat(40), secret = 'synthetic-SECRET-never-publish';
const finding = { key: 'http.security.csp', domain: 'security', severity: 'important' };
const issue = { id: finding.key, categoryKey: finding.domain, severity: finding.severity,
  confidence: 'UNKNOWN', title: secret, impact: secret, recommendation: secret, evidence: secret };
const deployment = SERVICES.map(service => ({ service, revision: sha, containerId: 'b'.repeat(64),
  imageId: 'sha256:' + 'c'.repeat(64), startedAt: '2026-10-17T12:00:00Z', restartCount: 0 }));
function report(issues = [issue]) {
  // The Java admission normalizer removes the root slash before composing the report.
  return { pageIdentity: { requested: SITE, destination: SITE + '/', redacted: false },
    scores: { globalAvailable: true,
      moduleExecution: { total: 8, completed: 8, failed: 0, partial: 0, skipped: 0, pending: 0, running: 0 },
      calculation: { scoringFingerprint: 'scoring-v13',
      measurementFingerprint: 'measurements-v3', scopeFingerprint: 'scope-hash' },
    coverage: { provisional: false, global: { sufficient: true, ratio: 0.9 },
      domains: ['security', 'performance', 'seo', 'a11y'].map(key => ({ key, ratio: 0.9, sufficient: true })),
      checks: issues.map(i => ({ key: i.id, domain: i.categoryKey, state: 'MEASURED', confidence: 'MEASURED' })) } },
    issues, token: secret, url: SITE + '/?password=' + secret };
}
const evidence = (findings = [finding]) => ({ schemaVersion: 1, policy: POLICY, expectedSha: sha,
  service: 'console-web', outcome: findings.some(i => i.severity === 'critical') ? 'SITE_NO_GO' : 'GO', findings });

test('two measured occurrences confirm a finding without copying report prose or secrets', () => {
  const result = evaluateReports(report(), report());
  assert.deepEqual(result, { outcome: 'GO', findings: [finding] });
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('canonical root URLs with and without a slash identify the same audited homepage', () => {
  for (const requested of [SITE, SITE + '/']) for (const destination of [SITE, SITE + '/']) {
    const r = report(); r.pageIdentity = { requested, destination, redacted: false };
    assert.deepEqual(evaluateReports(r, report()), { outcome: 'GO', findings: [finding] });
  }
});

test('homepage equivalence rejects other paths, origins, ports, credentials, queries and fragments', () => {
  for (const value of [undefined, null, SITE + '/login', SITE + '/?query=x', SITE + '?query=x',
    SITE + '/#fragment', SITE + '#fragment', SITE + ':443/', SITE + '.example/',
    'http://argos.lelouet.fr/', 'https://user:pass@argos.lelouet.fr/']) {
    for (const key of ['requested', 'destination']) {
      const r = report(); r.pageIdentity[key] = value;
      assert.throws(() => evaluateReports(report(), r), error => error instanceof ControlError && error.code === 'target-unverified');
    }
  }
});

test('a critical finding blocks only when critical in both samples; scores alone never open tickets', () => {
  const critical = { ...issue, severity: 'critical' };
  assert.equal(evaluateReports(report([critical]), report([critical])).outcome, 'SITE_NO_GO');
  assert.equal(evaluateReports(report(), report([critical])).outcome, 'GO');
  assert.deepEqual(evaluateReports(report(), report([])), { outcome: 'GO', findings: [] });
});

test('opportunities, unknown keys, low confidence, aggregate scores and unmeasured findings are skipped', () => {
  for (const changed of [{ severity: 'info' }, { id: 'lighthouse.score.performance' },
    { id: secret }, { categoryKey: 'performance' }, { confidence: 'LOW' }]) {
    const r = report([{ ...issue, ...changed }]);
    assert.deepEqual(evaluateReports(r, r).findings, []);
  }
  for (const state of ['UNAVAILABLE', 'BLOCKED_BY_ANTIBOT', 'NOT_APPLICABLE']) {
    const r = report(); r.scores.coverage.checks[0].state = state;
    assert.deepEqual(evaluateReports(r, r).findings, []);
  }
  const partial = report(); partial.scores.coverage.checks[0].confidence = 'PARTIAL';
  assert.deepEqual(evaluateReports(partial, partial).findings, []);
});

test('insufficient/absent coverage, anti-bot, changed target or fingerprints are technical failures', () => {
  for (const mutate of [r => { r.scores.coverage = null; }, r => { r.antiBot = { detected: true }; },
    r => { r.scores.coverage.domains.pop(); }, r => { r.scores.coverage.global.ratio = 0.79; },
    r => { r.pageIdentity.destination = SITE + '/login'; }, r => { r.pageIdentity.redacted = true; },
    r => { r.scores.globalAvailable = false; }, r => { r.scores.calculation = null; },
    r => { r.scores.moduleExecution = null; }, r => { r.scores.moduleExecution.partial = 1; },
    r => { r.scores.calculation.measurementFingerprint = 'other'; }]) {
    const r = report(); mutate(r);
    assert.throws(() => evaluateReports(report(), r), ControlError);
  }
});

test('reviewed ticket keys still belong to their exact scored domain in the Java catalogue', () => {
  const java = readFileSync(new URL('../../apps/api-backend/src/main/java/com/dokor/argos/services/analysis/scoring/DefaultScorePolicy.java', import.meta.url), 'utf8');
  for (const [key, domain] of Object.entries(CHECKS)) {
    const escaped = key.replaceAll('.', '\\.');
    assert.match(java, new RegExp(`map\\.put\\("${escaped}",\\s+rule\\(true,\\s+[0-9]+,\\s+"${domain}"`), key);
  }
});

test('idempotency keys survive HTTP retries; new workflow attempts, runtime identities and samples stay independent', () => {
  const key = analysisKey(deployment, 0, '12345:1');
  assert.match(key, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.equal(key, analysisKey(structuredClone(deployment), 0, '12345:1'));
  assert.notEqual(key, analysisKey(deployment, 1, '12345:1'));
  assert.notEqual(key, analysisKey(deployment, 0, '12345:2'));
  assert.notEqual(key, analysisKey([{ ...deployment[0], containerId: 'd'.repeat(64) }, ...deployment.slice(1)], 0, '12345:1'));
  assert.equal(ticketMarker(finding.key), ticketMarker(finding.key));
});

function dockerFixture({ revision = sha, state = 'running', health, changedImage = false } = {}) {
  return args => args[0] === 'container' ? JSON.stringify([{
    Id: 'b'.repeat(64), Image: deployment[0].imageId, State: { Status: state, OOMKilled: false,
      StartedAt: deployment[0].startedAt, ...(health ? { Health: { Status: health } } : {}) },
    RestartCount: 0, Config: { Env: [secret] }, Mounts: [secret],
  }]) : JSON.stringify([{ Id: changedImage ? 'sha256:' + 'd'.repeat(64) : args[2],
    Config: { Labels: { 'org.opencontainers.image.revision': revision, private: secret }, Env: [secret] } }]);
}

test('actual immutable image and container identities are observed; other services may have older SHAs', () => {
  assert.deepEqual(deploymentSnapshot(sha, 'console-web', dockerFixture()), deployment);
  assert.ok(!JSON.stringify(deploymentSnapshot(sha, 'console-web', dockerFixture())).includes(secret));
  const docker = dockerFixture({ revision: 'd'.repeat(40) });
  let imageCalls = 0;
  const actual = deploymentSnapshot(sha, 'console-web', args => {
    const value = JSON.parse(docker(args));
    if (args[0] === 'image' && ++imageCalls === 2) value[0].Config.Labels['org.opencontainers.image.revision'] = sha;
    return JSON.stringify(value);
  });
  assert.equal(actual[1].revision, sha);
  assert.equal(actual[0].revision, 'd'.repeat(40));
});

test('wrong or unknown deployed SHA, unhealthy/restarting runtime and changed image fail closed', () => {
  for (const options of [{ revision: 'd'.repeat(40) }, { revision: 'unknown' }, { state: 'exited' },
    { health: 'unhealthy' }, { health: 'starting' }, { changedImage: true }])
    assert.throws(() => deploymentSnapshot(sha, 'console-web', dockerFixture(options)), ControlError);
  assert.throws(() => deploymentSnapshot(sha, 'console-web', () => { throw new Error(secret); }), /runtime-unavailable/);
});

test('a grouped deployment verifies every selected revision and permits older unaffected services', () => {
  const selected = ['api-backend', 'console-web'];
  for (const stale of SERVICES) {
    let current;
    const base = dockerFixture();
    const docker = args => {
      if (args[0] === 'container') current = args[2];
      const value = JSON.parse(base(args));
      if (args[0] === 'image' && current === stale) value[0].Config.Labels['org.opencontainers.image.revision'] = 'd'.repeat(40);
      return JSON.stringify(value);
    };
    if (selected.includes(stale)) assert.throws(() => deploymentSnapshot(sha, selected, docker), /revision-unverified/);
    else assert.equal(deploymentSnapshot(sha, selected, docker).length, 4);
  }
});

test('service lists reject empty, duplicated, unknown or malformed deployment input', () => {
  assert.deepEqual(normalizeServices(['console-web', 'api-backend']), ['api-backend', 'console-web']);
  assert.deepEqual(parseServices('["console-web"]'), ['console-web']);
  for (const value of [null, [], ['console-web', 'console-web'], ['unknown'], {}, 1]) {
    assert.throws(() => normalizeServices(value), ControlError);
    assert.equal(parseServices(JSON.stringify(value)), null);
  }
  assert.equal(parseServices('not-json'), null);
});

function collectorFixture({ failed, pending = false, reject, change = false } = {}) {
  const calls = [];
  let samples = 0, snapshots = 0, clock = 0;
  const client = {
    async login() { calls.push('login'); }, async logout() { calls.push('logout'); },
    async request(path, options) {
      calls.push({ path, options });
      if (path === '/api/account/analyses') {
        if (reject) throw new ControlError(reject);
        return { runId: String(++samples) };
      }
      if (/\/runs\/\d+$/.test(path)) return { status: failed ? 'FAILED' : pending ? 'QUEUED' : 'COMPLETED' };
      if (path.endsWith('/report')) return report();
      return {};
    },
  };
  return { calls, options: { expectedSha: sha, service: 'console-web', email: secret, password: secret, invocation: '12345:1',
    snapshot: () => { snapshots++; return change && snapshots > 1 ? [] : deployment; },
    client, now: () => clock, wait: async ms => { clock += ms; } } };
}

test('full control authenticates, checks usage, creates exactly two idempotent personal analyses and logs out', async () => {
  const f = collectorFixture(), result = await collectAudit(f.options);
  assert.equal(result.outcome, 'GO'); assert.deepEqual(result.findings, [finding]);
  assert.deepEqual(f.calls.filter(c => typeof c === 'string'), ['login', 'logout']);
  assert.ok(f.calls.some(c => c.path === '/api/account/usage'));
  const creates = f.calls.filter(c => c.path === '/api/account/analyses');
  assert.equal(creates.length, 2); assert.notEqual(creates[0].options.key, creates[1].options.key);
  assert.equal(creates[0].options.retry, true); assert.ok(!JSON.stringify(result).includes(secret));
});

test('one grouped control creates two analyses in total and binds ticket evidence to all deployed services', async () => {
  const f = collectorFixture();
  f.options.services = SERVICES;
  const result = await collectAudit(f.options);
  assert.equal(result.outcome, 'GO');
  assert.deepEqual(result.services, SERVICES);
  assert.equal(f.calls.filter(call => call.path === '/api/account/analyses').length, 2);
  assert.deepEqual(ticketInput(result, sha, SERVICES), [finding]);
  assert.throws(() => ticketInput(result, sha, ['console-web']), ControlError);
  assert.throws(() => ticketInput({ ...result, services: ['console-web'] }, sha, SERVICES), ControlError);
});

test('audit timeout, failed run, changed deployment, bad auth and quota never emit actionable findings', async () => {
  for (const [settings, reason] of [[{ failed: true }, 'audit-failed'], [{ pending: true }, 'audit-timeout'],
    [{ change: true }, 'deployment-changed'], [{ reject: 'rate-limited' }, 'rate-limited']]) {
    const f = collectorFixture(settings), result = await collectAudit(f.options);
    assert.equal(result.outcome, 'CONTROL_FAILED'); assert.equal(result.reason, reason);
    assert.deepEqual(result.findings, []); assert.equal(f.calls.at(-1), 'logout');
  }
  const f = collectorFixture(); f.options.client.login = async () => { throw new Error(secret); };
  const result = await collectAudit(f.options);
  assert.equal(result.reason, 'control-failed'); assert.ok(!JSON.stringify(result).includes(secret));
});

test('service readiness has a deadline and never creates audits when runtime is unverified', async () => {
  const f = collectorFixture();
  f.options.snapshot = () => { throw new ControlError('revision-unverified'); };
  const result = await collectAudit(f.options);
  assert.equal(result.reason, 'health-timeout'); assert.equal(f.calls.length, 1);
});

test('invalid configuration is recorded without publishing the supplied values', async () => {
  const f = collectorFixture(); f.options.expectedSha = secret; f.options.service = secret;
  const result = await collectAudit(f.options);
  assert.equal(result.reason, 'configuration-invalid');
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('CLI persists a filtered technical verdict, signals Actions and exits 2 without making network calls', () => {
  const root = mkdtempSync(join(tmpdir(), 'argos-self-audit-'));
  try {
    const output = join(root, 'actions-output'), summary = join(root, 'actions-summary');
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('./self-audit.mjs', import.meta.url))], {
      cwd: root, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, EXPECTED_SHA: secret, DEPLOYED_SERVICES: secret,
        ARGOS_CI_EMAIL: secret, ARGOS_CI_PASSWORD: secret, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
    });
    assert.equal(run.status, 2, run.stderr);
    const raw = readFileSync(join(root, 'outputs/post-deploy-audit.json'), 'utf8');
    assert.equal(JSON.parse(raw).outcome, 'CONTROL_FAILED');
    assert.equal(JSON.parse(raw).reason, 'configuration-invalid');
    assert.equal(readFileSync(output, 'utf8'), 'outcome=CONTROL_FAILED\n');
    assert.ok(![raw, run.stdout, run.stderr, readFileSync(summary, 'utf8')].join('').includes(secret));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
test('real HTTP adapter carries CSRF and session cookies, respects Retry-After and refuses redirects', async () => {
  const calls = [], waits = [], csrf = 'c'.repeat(43);
  let attempts = 0;
  const client = accountClient({ wait: async ms => waits.push(ms), fetcher: async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal);
    if (url.endsWith('/csrf')) return json({ csrf }, 200, { 'Set-Cookie': `argos_account_csrf=${csrf}; Secure; HttpOnly` });
    if (url.endsWith('/login')) {
      assert.equal(init.headers.Cookie, `argos_account_csrf=${csrf}`);
      assert.equal(init.headers['X-Argos-CSRF'], csrf); assert.equal(init.headers.Origin, SITE);
      return json({ verified: true }, 200, { 'Set-Cookie': 'argos_account=synthetic-session; HttpOnly; Secure' });
    }
    assert.ok(init.headers.Cookie.includes('argos_account=synthetic-session'));
    if (attempts++ === 0) return json({}, 429, { 'Retry-After': '2' });
    return json({ canLaunch: true });
  } });
  await client.login('ci@example.test', secret);
  await client.request('/api/account/usage');
  assert.deepEqual(waits, [2000]); assert.equal(calls.length, 4);
});

test('ambiguous login is not retried; idempotent admission is; long Retry-After stops without waiting early', async () => {
  for (const retry of [false, true]) {
    let calls = 0;
    const client = accountClient({ wait: async () => {}, fetcher: async () => { calls++; throw new Error(secret); } });
    await assert.rejects(client.request('/api/account/analyses', { method: 'POST', retry }), ControlError);
    assert.equal(calls, retry ? 3 : 1);
  }
  const client = accountClient({ wait: async () => assert.fail('must honor long Retry-After by stopping'),
    fetcher: async () => json({ error: secret }, 429, { 'Retry-After': '3600' }) });
  await assert.rejects(client.request('/api/account/usage'), /rate-limited/);
});

test('malformed, oversized and unauthorized HTTP responses do not escape as raw errors', async () => {
  for (const response of [new Response(secret), new Response('x'.repeat(2 * 1024 * 1024 + 1)), json({ error: secret }, 401)]) {
    const client = accountClient({ fetcher: async () => response });
    await assert.rejects(client.request('/api/account/usage'), error => !error.message.includes(secret));
  }
});

test('ticket permission boundary rejects technical, unknown or mismatched evidence and discards extra prose', () => {
  assert.deepEqual(ticketInput({ ...evidence(), token: secret }, sha, 'console-web'), [finding]);
  for (const value of [{ ...evidence(), outcome: 'CONTROL_FAILED' }, { ...evidence(), expectedSha: 'd'.repeat(40) },
    { ...evidence(), findings: [{ ...finding, key: secret }] }, { ...evidence(), findings: [finding, finding] },
    { ...evidence(), outcome: 'SITE_NO_GO' }]) assert.throws(() => ticketInput(value, sha, 'console-web'), ControlError);
});

const syncOptions = api => ({ evidence: evidence(), sha, service: 'console-web', runId: '12345', api });
test('ticket synchronization creates once, skips exact reruns and reopens the same manually closed issue', async () => {
  const issues = [], writes = [];
  const api = async (method, path, body) => {
    if (method === 'GET') return structuredClone(issues);
    writes.push({ method, path, body });
    if (method === 'POST') issues.push({ number: 123, user: { login: 'github-actions[bot]' }, state: 'open', ...body });
    else Object.assign(issues[0], body);
  };
  assert.deepEqual(await synchronizeTickets(syncOptions(api)), { created: 1, updated: 0 });
  assert.deepEqual(await synchronizeTickets(syncOptions(api)), { created: 0, updated: 0 });
  issues[0].state = 'closed'; issues[0].body += '\nHuman triage note';
  assert.deepEqual(await synchronizeTickets(syncOptions(api)), { created: 0, updated: 1 });
  assert.ok(issues[0].body.endsWith('Human triage note'));
  assert.equal(issues[0].state, 'open'); assert.ok(!JSON.stringify(writes).includes(secret));
});

test('tickets paginate all states, ignore human/PR markers and update across deployments without duplicates', async () => {
  const writes = [], gets = [];
  const old = ticketBody(finding, 'd'.repeat(40), 'api-backend', '999');
  const api = async (method, path, body) => {
    if (method !== 'GET') { writes.push({ method, path, body }); return {}; }
    gets.push(path);
    if (gets.length === 1) return Array.from({ length: 100 }, () => ({ user: { login: 'human' }, body: old }));
    return [{ number: 9, user: { login: 'github-actions[bot]' }, state: 'open', body: old },
      { number: 10, user: { login: 'github-actions[bot]' }, body: old, pull_request: {} }];
  };
  assert.deepEqual(await synchronizeTickets(syncOptions(api)), { created: 0, updated: 1 });
  assert.match(gets[1], /state=all.*page=2/); assert.equal(writes[0].path, '/issues/9');
});

test('empty controls never close issues; duplicate markers and incomplete pagination never create more tickets', async () => {
  const api = async () => assert.fail('empty controls have no ticket work');
  await synchronizeTickets({ ...syncOptions(api), evidence: evidence([]) });
  const entry = { user: { login: 'github-actions[bot]' }, body: ticketBody(finding, sha, 'console-web', '123') };
  await assert.rejects(synchronizeTickets(syncOptions(async method => {
    assert.equal(method, 'GET'); return [entry, entry];
  })), /ticket-duplicates-exist/);
  let pages = 0;
  await assert.rejects(synchronizeTickets(syncOptions(async method => {
    assert.equal(method, 'GET'); pages++; return Array(100).fill({});
  })), /github-pagination-limit/);
  assert.equal(pages, 20);
});

test('GitHub writes never retry ambiguous creation; reads have bounded retries and fixed host', async () => {
  for (const method of ['GET', 'POST', 'PATCH']) {
    let calls = 0;
    const api = githubApi(secret, { wait: async () => {}, fetcher: async (url, options) => {
      assert.equal(url, 'https://api.github.com/repos/dokor/argos/issues');
      assert.equal(options.redirect, 'error'); calls++; throw new Error(secret);
    } });
    await assert.rejects(api(method, '/issues'), error => !error.message.includes(secret));
    assert.equal(calls, method === 'GET' ? 3 : 1);
  }
});

test('deployment workflows call the same control only after deployment; credentials stay out of the writer job', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/post-deploy-audit.yml', import.meta.url), 'utf8');
  assert.ok(!workflow.includes('schedule:')); assert.ok(!workflow.includes('workflow_dispatch:'));
  assert.match(workflow, /needs.control.outputs.outcome == 'SITE_NO_GO'/);
  assert.match(workflow, /artifact_name: self-audit-.*github.run_attempt/);
  assert.match(workflow, /name: \$\{\{ needs.control.outputs.artifact_name \}\}/);
  assert.ok(!workflow.split('\n  tickets:')[0].includes('issues: write'));
  assert.ok(!workflow.split('\n  tickets:')[1].includes('ARGOS_CI_'));
  const caller = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(caller, /post-deploy-audit:\s+needs: \[changes, deploy, cleanup\]\s+uses: \.\/\.github\/workflows\/post-deploy-audit.yml/);
  assert.equal(caller.split('uses: ./.github/workflows/post-deploy-audit.yml').length - 1, 1);
  assert.ok(caller.includes('services: ${{ needs.changes.outputs.services }}'));
  assert.match(caller, /group: deploy-production\s+queue: max\s+cancel-in-progress: false/);
  assert.match(caller, /fail-fast: false\s+max-parallel: 1/);
  assert.ok(!workflow.includes('DEPLOYED_SERVICE:'));
  assert.ok(workflow.includes('DEPLOYED_SERVICES: ${{ inputs.services }}'));
});
