import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { main } from '../../clients/ci/src/client.mjs';
import { githubPublication } from '../../clients/ci/src/github-publication.mjs';
import { azureJournal } from '../../clients/ci/src/azure-journal.mjs';
import { sealProof, openProof } from '../../clients/ci/src/private-transfer.mjs';
import { publicationConfiguration, PUBLIC_ISSUE } from '../../clients/ci/src/publication-policy.mjs';
import { writePrivate } from '../../clients/ci/src/evidence.mjs';
import { policy, VERSION } from '../../clients/ci/src/resources.mjs';

const clock = Date.parse('2026-10-19T00:00:00Z'), now = () => clock;
const d = { provider: 'github', origin: 'https://api.github.com', id: '42', repository: 'customer/site', visibility: 'private', botId: '41898282' };
const config = publicationConfiguration({ mode: 'SYNC', destination: d, allowPrivateDetails: true });
const provenance = { provider: 'github', repository: d.repository, sha: 'a'.repeat(40), invocation: '123:1', producerId: 'argos_control', environment: 'production' };
const verdict = { apiVersion: 1, kind: 'verdict-v1', admissionId: 'a2942a5c-b63a-45cd-a88a-d02b1af5db02', policyId: policy.policyId,
  policyFingerprint: policy.fingerprint, sampleCount: 2, outcome: 'GO', exitCode: 0, error: null,
  fingerprints: { scoring: 'b'.repeat(64), measurement: 'c'.repeat(64), scope: 'd'.repeat(64), evidence: 'e'.repeat(64) },
  confirmedFindings: [{ key: 'http.security.csp', category: 'security', severity: 'important', ticketEligible: true }] };
const proof = { schemaVersion: 2, kind: 'ci-evidence-v2', clientVersion: VERSION, provenance, issuedAt: new Date(clock - 1000).toISOString(),
  observationStartedAt: new Date(clock - 10000).toISOString(), sourceExpiresAt: new Date(clock + 86400000).toISOString(),
  expiresAt: new Date(clock + 86400000).toISOString(), admissionId: verdict.admissionId, samples: 2, runIds: ['1', '2'], verdict };
function sas(access = 'rw') {
  return 'https://argosfixture.blob.core.windows.net/private/journal.json?' + new URLSearchParams({ sv: '2023-11-03', sp: access,
    sr: 'b', spr: 'https', se: new Date(clock + 86400000).toISOString(), sig: Buffer.alloc(32, 7).toString('base64') });
}
const environment = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: d.repository, GITHUB_REPOSITORY_ID: d.id, GITHUB_SHA: provenance.sha,
  GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'argos_publish', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main',
  GITHUB_SERVER_URL: 'https://github.com', GITHUB_API_URL: d.origin, GITHUB_TOKEN: 'ghs_' + 'x'.repeat(36),
  ARGOS_EVIDENCE_PRODUCER: 'argos_control', ARGOS_PUBLICATION_CONFIG: JSON.stringify(config), ARGOS_GITHUB_JOURNAL_SAS_URL: sas(),
  ARGOS_GITHUB_JOURNAL_READ_SAS_URL: sas('r') };

// Independent HTTP state machine: enforces actual Azure header/lease/CAS semantics, not engine flags.
function fixture(t, publication = config, evidence = proof) {
  const root = fs.mkdtempSync(join(tmpdir(), 'argos-github-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(join(root, 'control')); fs.mkdirSync(join(root, 'publisher'));
  const digest = writePrivate(join(root, 'control/evidence.json'), evidence);
  const state = { calls: [], issues: [], posts: [], visibility: publication.destination.visibility, bot: 41898282,
    hasIssues: true, archived: false, publicStorage: false, missingBlob: false, etag: 1, lease: null, lose: false, hide: false,
    status: null, createStatus: null, postAttempts: 0, poisonLink: false, pages: null, corruptViewer: false, failedSave: false,
    envelope: { version: 1, destinationId: d.id, repository: d.repository, evidenceKey: randomBytes(32).toString('base64'),
      journal: { version: 1, revision: 'initial', destinationId: d.id, records: [], budgets: [] } } };
  function issue(payload, number = state.issues.length + 1) { return { id: 1000 + number, number, url: d.origin + '/repos/' + d.repository + '/issues/' + number,
    state: 'open', state_reason: null, title: payload.title, body: payload.body, labels: payload.labels.map(name => ({ name })),
    user: { id: 41898282, type: 'Bot' }, created_at: new Date(clock).toISOString(), updated_at: new Date(clock).toISOString() }; }
  async function fetcher(url, options) {
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    const u = new URL(url), headers = new Headers(options.headers); state.calls.push({ origin: u.origin, method: options.method, path: u.pathname });
    assert.notEqual(u.origin, 'https://argos.lelouet.fr', 'Publisher/staging must never call the audit API');
    if (u.hostname.endsWith('.blob.core.windows.net')) {
      assert.equal(headers.get('authorization'), null, 'Git credentials never reach storage');
      const response = (value, status, h = {}) => new Response(value === null ? null : JSON.stringify(value), { status,
        headers: { 'content-type': 'application/json', 'x-ms-request-id': 'fixture', ...h } });
      if (!u.search) return response(null, state.publicStorage ? 200 : 403);
      if (state.missingBlob) return response(null, 404);
      if (u.searchParams.get('comp') === 'lease') {
        const action = headers.get('x-ms-lease-action');
        if (action === 'acquire') { if (state.lease) return response(null, 409); state.lease = headers.get('x-ms-proposed-lease-id'); }
        else if (headers.get('x-ms-lease-id') !== state.lease) return response(null, 412);
        const lease = state.lease; if (action === 'release') state.lease = null;
        return response(null, action === 'acquire' ? 201 : 200, { 'x-ms-lease-id': lease });
      }
      if (options.method === 'PUT') {
        assert.equal(u.searchParams.get('sp'), 'rw');
        if (state.failedSave) return response(null, 503);
        if (!state.lease || headers.get('x-ms-lease-id') !== state.lease || headers.get('if-match') !== `"${state.etag}"`) return response(null, 412);
        state.envelope = JSON.parse(options.body); state.etag++;
        return response(null, 201, { etag: `"${state.etag}"` });
      }
      return response(state.envelope, 200, { etag: `"${state.etag}"`, 'x-ms-blob-type': 'BlockBlob' });
    }
    assert.equal(u.origin, d.origin); assert.equal(headers.get('authorization'), 'Bearer ' + environment.GITHUB_TOKEN);
    if (state.status) return new Response('synthetic-private-739 ::error::', { status: state.status,
      headers: state.status === 429 ? { 'retry-after': '60' } : {} });
    if (u.pathname === '/graphql') { assert.match(JSON.parse(options.body).query, /^query /);
      return Response.json({ data: { viewer: { login: 'github-actions[bot]', databaseId: state.bot, __typename: 'User' } },
        ...(state.corruptViewer ? { errors: [{ message: 'synthetic-private-739' }] } : {}) }); }
    const repoRoot = '/repos/' + d.repository;
    if (u.pathname === repoRoot) return Response.json({ id: 42, full_name: d.repository, fork: false, archived: state.archived, disabled: false,
      has_issues: state.hasIssues, visibility: state.visibility, private: state.visibility === 'private', default_branch: 'main' });
    if (u.pathname === repoRoot + '/issues' && options.method === 'POST') {
      assert.equal(state.envelope.journal.records.at(-1).phase, 'CREATE_PENDING');
      state.postAttempts++;
      if (state.createStatus) return new Response('synthetic-private-739 ::error::', { status: state.createStatus,
        headers: state.createStatus === 429 ? { 'retry-after': '60' } : {} });
      state.posts.push(JSON.parse(options.body)); const row = issue(state.posts.at(-1)); state.issues.push(row);
      if (state.lose) throw new Error('synthetic-private-739'); return Response.json(row, { status: 201 });
    }
    if (u.pathname === repoRoot + '/issues') {
      const page = Number(u.searchParams.get('page')), rows = state.hide ? [] : state.pages?.[page - 1] ?? state.issues;
      const next = state.pages && page < state.pages.length;
      return Response.json(rows, { headers: state.poisonLink ? { link: '<https://elsewhere.invalid/issues?page=2>; rel="next"' }
        : next ? { link: `<${d.origin}${repoRoot}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page + 1}>; rel="next"` } : {} });
    }
    return Response.json(state.issues.find(row => u.pathname === repoRoot + '/issues/' + row.number));
  }
  const env = { ...environment, ARGOS_PUBLICATION_CONFIG: JSON.stringify(publication), ARGOS_EVIDENCE_SHA256: digest,
    ARGOS_OUTPUT_DIR: join(root, 'control') };
  const stage = () => main(['publication-stage'], env, { fetcher, now });
  async function publish(extra = {}) {
    const staged = await stage(); assert.equal(staged.proofStaged, true);
    fs.copyFileSync(join(root, 'control/evidence.enc.json'), join(root, 'publisher/evidence.enc.json'));
    fs.unlinkSync(join(root, 'control/evidence.enc.json'));
    return main(['publish-github'], { ...env, ARGOS_OUTPUT_DIR: join(root, 'publisher'), ARGOS_CIPHER_SHA256: staged.cipherSha256, ...extra }, { fetcher, now, sleep: async () => {} });
  }
  return { state, root, env, fetcher, issue, stage, publish, api: () => githubPublication(publication, env, { fetcher, now }),
    store: () => azureJournal(sas(), publication.destination, { fetcher, now }) };
}

test('GitHub: isolated staging reads only; publishing creates once across client instances and never sends Argos keys', async t => {
  const f = fixture(t); const staged = await f.stage(); assert.equal(staged.proofStaged, true); assert.equal(f.state.posts.length, 0);
  assert.ok(f.state.calls.every(c => c.origin === d.origin || ['GET', 'HEAD'].includes(c.method)));
  fs.unlinkSync(join(f.root, 'control/evidence.enc.json'));
  const result = await f.publish(); assert.equal(result.exitCode, 0); assert.equal(result.counts.created, 1);
  assert.equal((await f.publish()).counts.unchanged, 1); assert.equal(f.state.posts.length, 1);
  assert.ok(!fs.existsSync(join(f.root, 'publisher/evidence.json'))); assert.equal(f.state.lease, null);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private|nonce|41898282|http\.security/);
});
test('definite POST refusal releases only its preparation; ambiguous 5xx remains reserved across publisher reruns', async t => {
  for (const status of [401, 403, 422, 429]) {
    const f = fixture(t); f.state.createStatus = status;
    const result = await f.publish(); assert.equal(result.exitCode, 3); assert.equal(result.auditExitCode, 0);
    assert.equal(f.state.envelope.journal.records.length, 0); assert.equal(f.state.envelope.journal.budgets[0].newIssues, 1);
    assert.equal(f.state.postAttempts, 1); assert.doesNotMatch(JSON.stringify(result), /synthetic-private|::error::/);
  }
  const f = fixture(t); f.state.createStatus = 503;
  assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.envelope.journal.records[0].phase, 'CREATE_PENDING');
  assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.postAttempts, 1);
});
test('publisher-only rerun accepts the original producer attempt, never an unrelated run or future attempt', async t => {
  const f = fixture(t);
  assert.equal((await f.publish({ GITHUB_RUN_ATTEMPT: '2', ARGOS_EVIDENCE_INVOCATION: '123:1' })).counts.created, 1);
  for (const invocation of ['124:1', '123:3', '123:1\n::error::']) {
    const result = await f.publish({ GITHUB_RUN_ATTEMPT: '2', ARGOS_EVIDENCE_INVOCATION: invocation });
    assert.equal(result.exitCode, 3); assert.equal(result.diagnostic.code, 'ARTIFACT_INVALID');
  }
  assert.equal(f.state.posts.length, 1);
});
test('destination-aware PREVIEW uses a read-only SAS without a lease or any Git/storage mutation', async t => {
  const f = fixture(t, { ...config, mode: 'PREVIEW' });
  const r = await f.publish(); assert.equal(r.publication, 'PREVIEW'); assert.equal(r.counts.created, 1);
  assert.equal(f.state.posts.length, 0);
  assert.ok(f.state.calls.every(c => c.method !== 'PUT' && (c.method !== 'POST' || c.path === '/graphql')));
});
test('public state cannot be reset to adopt a copied generic notice or silently create another', async t => {
  const publicConfig = { ...config, destination: { ...d, visibility: 'public' }, allowPrivateDetails: false, allowPublicNotice: true };
  const f = fixture(t, publicConfig); await f.publish();
  f.state.envelope.journal = { version: 1, revision: 'new', destinationId: d.id, records: [], budgets: [] };
  assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.posts.length, 1);
});
test('a confirmed defect still publishes and keeps audit exit 1', async t => {
  const failed = { ...proof, verdict: { ...verdict, outcome: 'SITE_NO_GO', exitCode: 1,
    confirmedFindings: verdict.confirmedFindings.map(f => ({ ...f, severity: 'critical' })) } };
  const f = fixture(t, config, failed); const result = await f.publish(); assert.equal(result.exitCode, 1); assert.equal(result.counts.created, 1);
});
test('ambiguous creation recovers the same nonce; invisible creation stays pending and never replays POST', async t => {
  const f = fixture(t); f.state.lose = true;
  assert.equal((await f.publish()).counts.reconciled, 1); assert.equal(f.state.posts.length, 1);
  const second = fixture(t); second.state.lose = true; second.state.hide = true;
  const unknown = await second.publish(); assert.equal(unknown.exitCode, 3); assert.equal(unknown.auditExitCode, 0);
  assert.equal(second.state.envelope.journal.records[0].phase, 'CREATE_PENDING');
  assert.equal((await second.publish()).publication, 'UNKNOWN'); assert.equal(second.state.posts.length, 1);
  second.state.hide = false; assert.equal((await second.publish()).counts.reconciled, 1);
});
test('human edits, ignore labels and every closure freeze GitHub automation; no PATCH is implemented', async t => {
  const f = fixture(t); await f.publish();
  const row = f.state.issues[0]; row.body = 'Keep my notes\n' + row.body; row.labels.push({ name: 'argos:accepted-risk' }); row.assignees = [{ id: 202 }];
  const before = structuredClone(row); assert.equal((await f.publish()).counts.suppressed, 1); assert.deepEqual(row, before);
  row.state = 'closed'; row.labels = []; assert.equal((await f.publish()).counts.suppressed, 1);
  assert.ok(f.state.calls.every(c => c.method !== 'PATCH'));
  const refused = await main(['publish-github'], { ...f.env, ARGOS_PUBLICATION_CONFIG: JSON.stringify({ ...config, reopenResolved: true }) }, { fetcher: () => assert.fail('unsafe reopen performed I/O'), now });
  assert.equal(refused.diagnostic.code, 'CONFIG_INVALID');
});
test('complete pagination filters PRs, validates origin/parameters and rejects forged GitHub ownership', async t => {
  const f = fixture(t); const pr = { pull_request: { url: 'not-an-issue' } };
  const first = f.issue({ title: 'Unrelated', body: 'Human text', labels: [] }); first.user = { id: 202, type: 'User' };
  f.state.pages = [[first, pr], []]; assert.equal((await f.api().listIssues(null, {})).nextCursor, '2');
  assert.equal((await f.api().listIssues('2', {})).complete, true);
  f.state.poisonLink = true; await assert.rejects(f.api().listIssues(null, {}), { code: 'PUBLICATION_STATE_UNKNOWN' });
  f.state.poisonLink = false; f.state.pages = null; await f.publish(); f.state.issues[0].user.id = 202;
  assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.posts.length, 1);
});
for (const change of ['bot', 'corruptViewer', 'visibility', 'hasIssues', 'archived']) {
  test(`GitHub refuses destination/identity drift: ${change}`, async t => {
    const f = fixture(t); f.state[change] = { bot: 202, corruptViewer: true, visibility: 'public', hasIssues: false, archived: true }[change];
    const r = await f.stage(); assert.equal(r.exitCode, 3); assert.equal(r.auditExitCode, 0); assert.equal(f.state.posts.length, 0);
  });
}
for (const [status, code] of [[401, 'PUBLICATION_AUTH_FAILED'], [403, 'DESTINATION_UNAVAILABLE'], [404, 'DESTINATION_UNAVAILABLE'],
  [422, 'CONFIG_INVALID'], [429, 'PUBLICATION_RATE_LIMITED'], [503, 'PUBLICATION_STATE_UNKNOWN']]) {
  test(`GitHub HTTP ${status} maps to ${code} without printing provider prose`, async t => {
    const f = fixture(t); f.state.status = status; const r = await f.stage();
    assert.equal(r.diagnostic.code, code); assert.doesNotMatch(JSON.stringify(r), /synthetic-private|::error::/); assert.equal(f.state.posts.length, 0);
  });
}
test('public repository transfers only ciphertext and publishes one strictly generic notice', async t => {
  const publicConfig = { ...config, destination: { ...d, visibility: 'public' }, allowPrivateDetails: false, allowPublicNotice: true };
  const f = fixture(t, publicConfig); const result = await f.publish(); assert.equal(result.counts.created, 1);
  assert.deepEqual(f.state.posts, [{ ...PUBLIC_ISSUE, labels: [] }]); assert.equal((await f.publish()).counts.unchanged, 1);
  const encrypted = fs.readFileSync(join(f.root, 'publisher/evidence.enc.json'), 'utf8');
  assert.doesNotMatch(encrypted, /http.security|admissionId|scope|runIds|customer\/site/);
});
test('lost public response needs an explicit trusted issue number; no generic text is auto-adopted', async t => {
  const publicConfig = { ...config, destination: { ...d, visibility: 'public' }, allowPrivateDetails: false, allowPublicNotice: true };
  const f = fixture(t, publicConfig); f.state.lose = true;
  assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.posts.length, 1);
  const linked = { ...publicConfig, publicIssueId: '1' }; f.env.ARGOS_PUBLICATION_CONFIG = JSON.stringify(linked);
  assert.equal((await f.publish()).counts.reconciled, 1); assert.equal(f.state.posts.length, 1);
});
test('storage enforces private access, a pre-existing durable registry and actual CAS/fence; never silently starts over', async t => {
  const f = fixture(t), store = f.store();
  await store.withDestinationLease(store.lockKey, async session => {
    const journal = await session.loadJournal(); const lease = await session.assertHeld();
    await assert.rejects(store.withDestinationLease(store.lockKey, () => assert.fail('second lease acquired')), { code: 'PUBLICATION_STATE_UNKNOWN' });
    await assert.rejects(session.saveJournal(journal, { expectedRevision: 'wrong', lease }), { code: 'PUBLICATION_STATE_UNKNOWN' });
    f.state.etag++; await assert.rejects(session.saveJournal(journal, { expectedRevision: journal.revision, lease }), { code: 'PUBLICATION_STATE_UNKNOWN' });
    f.state.lease = 'new-owner'; await assert.rejects(session.assertHeld(), { code: 'PUBLICATION_STATE_UNKNOWN' });
  });
  f.state.lease = null; f.state.publicStorage = true;
  await assert.rejects(store.loadJournal(), { code: 'DESTINATION_UNAVAILABLE' });
  f.state.publicStorage = false; f.state.missingBlob = true;
  await assert.rejects(store.loadJournal(), { code: 'PUBLICATION_STATE_UNKNOWN' }); assert.equal(f.state.posts.length, 0);
});
test('a failed write-ahead save blocks POST, a stale fence blocks late journal overwrites', async t => {
  const f = fixture(t); f.state.failedSave = true; const r = await f.publish();
  assert.equal(r.exitCode, 3); assert.equal(f.state.posts.length, 0); assert.equal(f.state.envelope.journal.records.length, 0);
  f.state.failedSave = false; const store = f.store(); let stale, journal, lease;
  await store.withDestinationLease(store.lockKey, async session => { stale = session; journal = await session.loadJournal(); lease = await session.assertHeld(); });
  await assert.rejects(stale.saveJournal(journal, { expectedRevision: journal.revision, lease }), { code: 'PUBLICATION_STATE_UNKNOWN' });
});
test('secrets and URL capabilities are strictly scoped; DISABLED performs zero provider/file access', async t => {
  const f = fixture(t);
  for (const changes of [{ GITHUB_TOKEN: 'github_pat_' + 'x'.repeat(40) }, { GITHUB_REPOSITORY_ID: '43' }, { ARGOS_API_KEY: 'forbidden' },
    { GITHUB_SERVER_URL: 'https://enterprise.invalid' }, { GITHUB_API_URL: 'https://elsewhere.invalid' }]) {
    assert.throws(() => githubPublication(config, { ...f.env, ...changes }), { code: changes.GITHUB_TOKEN ? 'PUBLICATION_AUTH_FAILED' : 'CONFIG_INVALID' });
  }
  for (const secret of [sas().replace('sp=rw', 'sp=rwd'), sas().replace('sr=b', 'sr=c'), sas().replace('https:', 'http:'),
    sas().replace('argosfixture.blob.core.windows.net', '127.0.0.1'), sas() + '&comp=lease', sas() + '&sp=rw']) {
    assert.throws(() => azureJournal(secret, d, { now }), { code: 'CONFIG_INVALID' });
  }
  const off = await main(['publish-github'], { ...f.env, ARGOS_PUBLICATION_CONFIG: '{}' }, { fetcher: () => assert.fail('disabled I/O'), now });
  assert.equal(off.publication, 'DISABLED'); assert.equal(off.exitCode, 0);
});
test('encrypted evidence rejects corruption, wrong key, digest, policy, producer, run, environment and expiration', async t => {
  const f = fixture(t), key = randomBytes(32), path = join(f.root, 'sealed.json');
  const expected = { ...provenance, digest: f.env.ARGOS_EVIDENCE_SHA256 };
  const digest = sealProof(proof, expected, config, key, path);
  assert.deepEqual(openProof(path, digest, expected, config, key, clock), proof);
  for (const changes of [{ producerId: 'another' }, { invocation: '123:2' }, { environment: 'staging' }, { sha: 'f'.repeat(40) }, { digest: '0'.repeat(64) }]) {
    assert.throws(() => openProof(path, digest, { ...expected, ...changes }, config, key, clock), { code: 'ARTIFACT_INVALID' });
  }
  assert.throws(() => openProof(path, digest, expected, { ...config, maxNewIssues: 1 }, key, clock), { code: 'ARTIFACT_INVALID' });
  assert.throws(() => openProof(path, digest, expected, config, randomBytes(32), clock), { code: 'ARTIFACT_INVALID' });
  assert.throws(() => openProof(path, digest, expected, config, key, clock + 900000), { code: 'ARTIFACT_INVALID' });
  fs.appendFileSync(path, 'corruption'); assert.throws(() => openProof(path, digest, expected, config, key, clock), { code: 'ARTIFACT_INVALID' });
});
