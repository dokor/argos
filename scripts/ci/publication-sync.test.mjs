import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { synchronizeIssues, PublicationRejected } from '../../clients/ci/src/publication-sync.mjs';
import { publicationConfiguration, candidates, PUBLIC_ISSUE, managedBlock } from '../../clients/ci/src/publication-policy.mjs';
import { writePrivate } from '../../clients/ci/src/evidence.mjs';
import { VERSION, policy, errors } from '../../clients/ci/src/resources.mjs';
import { Failure } from '../../clients/ci/src/diagnostics.mjs';

const clock = Date.parse('2026-10-19T00:00:00Z'), iso = offset => new Date(clock + offset).toISOString();
const none = { kind: 'NONE', authorized: false, actorId: null, at: null, until: null, version: 'none' };
const provenance = { provider: 'github', repository: 'customer/site', sha: 'a'.repeat(40), invocation: '123:1', producerId: 'argos_control', environment: 'production' };
const finding = key => ({ key, category: key.startsWith('http.security') ? 'security' : 'seo', severity: 'important', ticketEligible: true });
const go = { apiVersion: 1, kind: 'verdict-v1', admissionId: 'a2942a5c-b63a-45cd-a88a-d02b1af5db02', policyId: policy.policyId,
  policyFingerprint: policy.fingerprint, sampleCount: 2, outcome: 'GO', exitCode: 0, error: null,
  fingerprints: { scoring: 'b'.repeat(64), measurement: 'c'.repeat(64), scope: 'd'.repeat(64), evidence: 'e'.repeat(64) }, confirmedFindings: [finding('http.security.csp')] };
const proof = overrides => ({ schemaVersion: 2, kind: 'ci-evidence-v2', clientVersion: VERSION, provenance, issuedAt: iso(-1000),
  observationStartedAt: iso(-10000), sourceExpiresAt: iso(86400000), expiresAt: iso(86400000), admissionId: go.admissionId, samples: 2, runIds: ['1', '2'], verdict: go, ...overrides });
function setup(t, provider = 'github', overrides = {}) {
  const root = fs.mkdtempSync(join(tmpdir(), 'argos-publish-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evidence = proof({ provenance: { ...provenance, provider }, ...overrides }), evidencePath = join(root, 'evidence.json');
  const hash = writePrivate(evidencePath, evidence);
  const config = publicationConfiguration({ mode: 'SYNC', allowPrivateDetails: true, destination: { provider,
    origin: provider === 'github' ? 'https://api.github.com' : 'https://gitlab.com', id: '42', repository: 'customer/site', visibility: 'private', botId: '101' } });
  const journalPath = join(root, 'journal.json');
  fs.writeFileSync(journalPath, JSON.stringify({ version: 1, revision: '1', destinationId: '42', records: [], budgets: [] }));
  let tail = Promise.resolve(), fence = 0, active = false;
  const state = { issues: [], payloads: [], calls: [], visibility: 'private', botVerified: true, conditionalReopen: true, hidden: false,
    onCreate: null, onReopen: null, onRead: null, loseFence: false, incomplete: false, cyclic: false };
  const journal = () => JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  const raw = issue => { const { rawLabels, rawAssignees, ...normalized } = issue; return structuredClone(normalized); };
  function makeAdapter() {
    const shared = {
      readDestination: async () => { state.calls.push('destination'); return { ...config.destination, visibility: state.visibility,
        botVerified: state.botVerified, issuesEnabled: true, conditionalReopen: state.conditionalReopen }; },
      listIssues: async cursor => {
        state.calls.push('list'); const start = cursor === null ? 0 : Number(cursor), rows = state.hidden ? [] : state.issues;
        const next = start + 100 < rows.length ? String(start + 100) : null;
        return { items: rows.slice(start, start + 100).map(raw), nextCursor: state.cyclic ? '0' : next, complete: !state.incomplete && !state.cyclic && next === null };
      },
      loadJournal: async () => { state.calls.push('journal-read'); return journal(); },
      readIssue: async id => { state.calls.push('issue-read'); await state.onRead?.(); return raw(state.issues.find(i => i.id === id)); },
    };
    return { ...shared, withDestinationLease: async (key, operation) => {
      state.calls.push('lease'); const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
      assert.equal(active, false); active = true; const heldFence = ++fence;
      const check = lease => { assert.equal(active, true); assert.equal(lease.fence, heldFence); assert.equal(lease.key, key); if (state.loseFence) throw new Failure('PUBLICATION_STATE_UNKNOWN'); };
      const session = { ...shared, capabilities: { version: 1, durableJournal: true, privateJournal: true, fencedLease: true },
        assertHeld: async () => ({ key, fence: state.loseFence ? heldFence + 1 : heldFence, validUntil: iso(60000) }),
        saveJournal: async (value, { expectedRevision, lease }) => {
          state.calls.push('journal-write'); check(lease); assert.equal(journal().revision, expectedRevision);
          const revision = String(Number(expectedRevision) + 1); fs.writeFileSync(journalPath, JSON.stringify({ ...value, revision }));
          return { revision, committed: true };
        },
        createIssue: async (payload, { lease }) => {
          state.calls.push('create'); check(lease); assert.equal(journal().records.at(-1).phase, 'CREATE_PENDING');
          state.payloads.push(structuredClone(payload));
          const issue = { id: String(500 + state.issues.length), destinationId: '42', authorId: '101', isBot: true, kind: 'issue', state: 'open',
            body: payload.body, revision: 'v1', createdAt: iso(0), decision: none, rawLabels: payload.labels, rawAssignees: ['human'] };
          await state.onCreate?.(issue); state.issues.push(issue);
          if (state.loseResponse) throw new Error('synthetic-private-738 ::error::');
          return raw(issue);
        },
        reopenIssue: async (request, { lease }) => {
          state.calls.push('reopen'); check(lease); const issue = state.issues.find(i => i.id === request.id);
          await state.onReopen?.(issue);
          if (issue.revision !== request.expectedRevision || issue.decision.version !== request.decisionVersion) throw new PublicationRejected('CONFIG_INVALID');
          assert.deepEqual(Object.keys(request).sort(), ['decisionVersion', 'expectedRevision', 'id']); issue.state = 'open'; issue.revision += 'x'; return raw(issue);
        } };
      try { return await operation(session); } finally { active = false; release(); }
    } };
  }
  let adapter = makeAdapter();
  const args = extra => ({ evidencePath, expected: { ...evidence.provenance, digest: hash }, auditVerdict: evidence.verdict,
    config, adapter, now: () => clock, sleep: async () => {}, ...extra });
  return { root, evidence, evidencePath, config, state, journal, args, reboot: () => { adapter = makeAdapter(); },
    write: value => { fs.unlinkSync(evidencePath); const digest = writePrivate(evidencePath, value); return args({ expected: { ...value.provenance, digest }, auditVerdict: value.verdict }); } };
}
function sessionPatch(f, patch) {
  const adapter = f.args().adapter;
  return { ...adapter, withDestinationLease: (key, operation, options) => adapter.withDestinationLease(key, session => operation(patch(session)), options) };
}

test('disabled is the default: no artifact, lock, read, write or provider call; preview never mutates a provider or journal', async t => {
  const unused = await synchronizeIssues(); assert.equal(unused.publication, 'DISABLED'); assert.equal(unused.exitCode, 0); assert.equal(unused.auditOutcome, 'UNKNOWN');
  const off = await synchronizeIssues({ auditVerdict: go, adapter: new Proxy({}, { get() { assert.fail('disabled touched adapter'); } }), evidencePath: 'missing' });
  assert.equal(off.publication, 'DISABLED'); assert.equal(off.exitCode, 0);
  const f = setup(t); const before = fs.readFileSync(join(f.root, 'journal.json'), 'utf8');
  const preview = await synchronizeIssues(f.args({ config: { ...f.config, mode: 'PREVIEW' } }));
  assert.equal(preview.publication, 'PREVIEW'); assert.equal(preview.counts.created, 1);
  assert.equal(fs.readFileSync(join(f.root, 'journal.json'), 'utf8'), before);
  assert.ok(f.state.calls.every(c => ['destination', 'list', 'journal-read'].includes(c))); assert.equal(f.state.payloads.length, 0);
});
test('checked-in provider configurations are strictly valid, disabled and require explicit publication consent', () => {
  for (const provider of ['github', 'gitlab']) {
    const sample = JSON.parse(fs.readFileSync(new URL(`../../clients/ci/examples/publication.${provider}.json`, import.meta.url)));
    const config = publicationConfiguration(sample); assert.equal(config.mode, 'DISABLED'); assert.equal(config.destination.provider, provider);
    assert.equal(config.allowPrivateDetails, false); assert.equal(config.allowPublicNotice, false); assert.equal(config.reopenResolved, false);
  }
});
test('a technical control or different original intention cannot be replaced by another successful artifact', async t => {
  const f = setup(t); const { stage, category, messageKey, actionCode, retryable, recovery } = errors.MEASUREMENT_INCOMPLETE;
  const technical = { ...go, outcome: 'CONTROL_FAILED', exitCode: 2, fingerprints: null, confirmedFindings: [],
    error: { code: 'MEASUREMENT_INCOMPLETE', stage, category, messageKey, actionCode, retryable, recovery, retryAfterSeconds: null } };
  const blocked = await synchronizeIssues(f.args({ auditVerdict: technical }));
  assert.equal(blocked.auditOutcome, 'CONTROL_FAILED'); assert.equal(blocked.exitCode, 2); assert.equal(f.state.calls.length, 0);
  const mismatch = await synchronizeIssues(f.args({ auditVerdict: { ...go, admissionId: 'b2942a5c-b63a-45cd-a88a-d02b1af5db02' } }));
  assert.equal(mismatch.diagnostic.code, 'ARTIFACT_INVALID'); assert.equal(f.state.calls.length, 0);
});
for (const provider of ['github', 'gitlab']) {
  test(`${provider}: same cause is created once across retries, concurrent calls and a durable journal restart`, async t => {
    const f = setup(t, provider); const results = await Promise.all([synchronizeIssues(f.args()), synchronizeIssues(f.args()), synchronizeIssues(f.args())]);
    assert.ok(results.every(r => r.publication === 'SUCCEEDED')); assert.equal(f.state.issues.length, 1); assert.equal(f.state.calls.filter(c => c === 'create').length, 1);
    f.reboot(); const again = await synchronizeIssues(f.args()); assert.equal(again.counts.unchanged, 1); assert.equal(again.exitCode, 0);
    assert.equal(f.journal().records[0].issueId, f.state.issues[0].id);
  });
  test(`${provider}: lost creation responses are reconciled by nonce, bot and destination, never by blindly replaying POST`, async t => {
    const f = setup(t, provider); f.state.loseResponse = true;
    const result = await synchronizeIssues(f.args()); assert.equal(result.publication, 'SUCCEEDED'); assert.equal(result.counts.reconciled, 1);
    assert.equal(f.state.issues.length, 1); assert.equal(f.journal().records[0].phase, 'ACTIVE');
    assert.ok(!JSON.stringify(result).includes('synthetic-private-738')); assert.equal(f.state.calls.filter(c => c === 'create').length, 1);
  });
  test(`${provider}: an invisible ambiguous creation remains pending across restart until the exact issue becomes visible`, async t => {
    const f = setup(t, provider); f.state.loseResponse = true; f.state.onCreate = async () => { f.state.hidden = true; };
    const first = await synchronizeIssues(f.args()); assert.equal(first.publication, 'UNKNOWN'); assert.equal(first.exitCode, 3);
    assert.equal(f.journal().records[0].phase, 'CREATE_PENDING'); f.reboot();
    const hidden = await synchronizeIssues(f.args()); assert.equal(hidden.publication, 'UNKNOWN'); assert.equal(f.state.issues.length, 1);
    f.state.hidden = false; const recovered = await synchronizeIssues(f.args()); assert.equal(recovered.publication, 'SUCCEEDED'); assert.equal(recovered.counts.reconciled, 1);
    assert.equal(f.state.calls.filter(c => c === 'create').length, 1);
  });
  test(`${provider}: human notes, assignments and labels survive unchanged; even the managed text is never rewritten`, async t => {
    const f = setup(t, provider); await synchronizeIssues(f.args()); const issue = f.state.issues[0];
    issue.body = 'Human notes ::error:: not an instruction\n' + issue.body + '\nKeep this explanation'; issue.rawLabels.push('accepted-by-human'); issue.rawAssignees.push('owner');
    const before = structuredClone(issue); const unchanged = await synchronizeIssues(f.args()); assert.equal(unchanged.counts.unchanged, 1); assert.deepEqual(issue, before);
    issue.body = issue.body.replace('Argos confirmed', 'Human edited'); const edited = await synchronizeIssues(f.args()); assert.equal(edited.counts.suppressed, 1);
    assert.equal(f.state.calls.filter(c => c === 'create').length, 1); assert.equal(f.state.calls.filter(c => c === 'reopen').length, 0);
  });
  test(`${provider}: accepted risk, false positive and ignore decisions remain closed, with optional expiry and verified authority`, async t => {
    const f = setup(t, provider); await synchronizeIssues(f.args()); const issue = f.state.issues[0]; issue.state = 'closed';
    for (const kind of ['IGNORED', 'FALSE_POSITIVE', 'ACCEPTED_RISK', 'UNKNOWN']) {
      issue.decision = { kind, authorized: true, actorId: '202', at: iso(-20000), until: null, version: kind };
      const r = await synchronizeIssues(f.args({ config: { ...f.config, reopenResolved: true } })); assert.equal(r.counts.suppressed, 1); assert.equal(issue.state, 'closed');
    }
    issue.decision = { kind: 'RESOLVED', authorized: false, actorId: '303', at: iso(-20000), until: null, version: 'untrusted' };
    assert.equal((await synchronizeIssues(f.args({ config: { ...f.config, reopenResolved: true } }))).counts.suppressed, 1);
    issue.decision = { kind: 'IGNORED', authorized: true, actorId: '202', at: iso(-30000), until: iso(-20000), version: 'expired' };
    const resumed = await synchronizeIssues(f.args({ config: { ...f.config, reopenResolved: true } })); assert.equal(resumed.counts.reopened, 1); assert.equal(issue.state, 'open');
  });
  test(`${provider}: only a later observation may reopen a resolved issue; refresh alone is not recurrence; no automatic close`, async t => {
    const f = setup(t, provider); await synchronizeIssues(f.args()); const issue = f.state.issues[0]; issue.state = 'closed';
    issue.decision = { kind: 'RESOLVED', authorized: true, actorId: '202', at: iso(-5000), until: null, version: 'resolved' };
    assert.equal((await synchronizeIssues(f.args({ config: { ...f.config, reopenResolved: true } }))).counts.suppressed, 1);
    issue.decision.at = iso(-20000); const body = issue.body;
    const recurrence = await synchronizeIssues(f.args({ config: { ...f.config, reopenResolved: true } })); assert.equal(recurrence.counts.reopened, 1); assert.equal(issue.body, body);
    const empty = { ...f.evidence, verdict: { ...go, confirmedFindings: [] } }; const absent = await synchronizeIssues(f.write(empty));
    assert.equal(absent.publication, 'NO_FINDINGS'); assert.equal(issue.state, 'open');
  });
}
test('notification and creation budgets persist per invocation across attempts; no comments or per-audit body changes', async t => {
  const keys = ['http.security.csp', 'http.security.hsts', 'html.title'];
  const f = setup(t, 'github', { verdict: { ...go, confirmedFindings: keys.map(finding) } });
  const limited = { ...f.config, maxNewIssues: 1, maxNotifications: 1 };
  const first = await synchronizeIssues(f.args({ config: limited })); assert.equal(first.publication, 'LIMIT_REACHED'); assert.equal(first.counts.created, 1); assert.equal(first.counts.limited, 2);
  f.reboot(); const again = await synchronizeIssues(f.args({ config: limited })); assert.equal(again.counts.created, 0); assert.equal(again.counts.limited, 2); assert.equal(f.state.issues.length, 1);
  const next = { ...f.evidence, provenance: { ...f.evidence.provenance, invocation: '124:1', sha: 'f'.repeat(40) } };
  const nextRun = await synchronizeIssues({ ...f.write(next), config: limited }); assert.equal(nextRun.counts.created, 1); assert.equal(f.state.issues.length, 2);
});
test('pagination is complete before mutations; truncated, cyclic, malformed, foreign or duplicate pages stop safely', async t => {
  for (const mode of ['incomplete', 'cyclic']) {
    const f = setup(t); f.state[mode] = true;
    const out = await synchronizeIssues(f.args()); assert.equal(out.publication, 'UNKNOWN'); assert.equal(f.state.payloads.length, 0); assert.equal(f.journal().records.length, 0);
  }
  const f = setup(t); for (let n = 1; n <= 105; n++) f.state.issues.push({ id: String(n), destinationId: '42', authorId: '202', isBot: false, kind: 'issue', state: 'open', body: 'human', revision: 'r1', createdAt: iso(-50000), decision: none });
  assert.equal((await synchronizeIssues(f.args())).counts.created, 1); assert.equal(f.state.calls.filter(c => c === 'list').length, 2);
  for (const change of [row => ({ ...row, destinationId: '99' }), row => ({ ...row, kind: 'pull_request' }), row => ({ ...row, raw: 'synthetic-private-738' })]) {
    const bad = setup(t); bad.state.issues.push(change(f.state.issues[0]));
    const out = await synchronizeIssues(bad.args()); assert.equal(out.publication, 'UNKNOWN'); assert.equal(bad.state.payloads.length, 0);
  }
  const duplicate = setup(t); duplicate.state.issues.push(f.state.issues[0], f.state.issues[0]);
  assert.equal((await synchronizeIssues(duplicate.args())).publication, 'UNKNOWN'); assert.equal(duplicate.state.payloads.length, 0);
});
test('forged markers, bot identity, changed destination and duplicate ownership receipts cannot be adopted', async t => {
  const fake = setup(t); const candidate = candidates(fake.evidence, fake.config)[0];
  fake.state.issues.push({ id: '99', destinationId: '42', authorId: '202', isBot: false, kind: 'issue', state: 'open', body: managedBlock(candidate, '1'.repeat(64)), revision: 'r1', createdAt: iso(0), decision: none });
  const forged = await synchronizeIssues(fake.args()); assert.equal(forged.publication, 'UNKNOWN'); assert.equal(fake.state.payloads.length, 0);
  const bot = setup(t); bot.state.botVerified = false; assert.equal((await synchronizeIssues(bot.args())).diagnostic.code, 'DESTINATION_UNAVAILABLE');
  const swapped = setup(t); swapped.state.visibility = 'public'; assert.equal((await synchronizeIssues(swapped.args())).diagnostic.code, 'DESTINATION_UNAVAILABLE'); assert.equal(swapped.state.payloads.length, 0);
  const ambiguous = setup(t); ambiguous.state.loseResponse = true; ambiguous.state.onCreate = async () => { ambiguous.state.hidden = true; };
  await synchronizeIssues(ambiguous.args()); ambiguous.state.hidden = false;
  ambiguous.state.issues.push({ ...ambiguous.state.issues[0], id: '999' });
  assert.equal((await synchronizeIssues(ambiguous.args())).publication, 'UNKNOWN'); assert.equal(ambiguous.state.payloads.length, 1);
});
test('public notice contains exactly the fixed public template, never a marker, target hash, finding, labels or credential', async t => {
  const f = setup(t); f.config.destination.visibility = 'public'; f.state.visibility = 'public'; f.config.allowPrivateDetails = false; f.config.allowPublicNotice = true;
  const result = await synchronizeIssues(f.args()); assert.equal(result.publication, 'SUCCEEDED'); assert.equal(f.state.payloads.length, 1);
  assert.deepEqual(f.state.payloads[0], { ...PUBLIC_ISSUE, labels: [] });
  assert.ok(!JSON.stringify(f.state.payloads).includes(go.fingerprints.scope)); assert.ok(!JSON.stringify(f.state.payloads).includes('http.security'));
  const ambiguous = setup(t); ambiguous.config.destination.visibility = 'public'; ambiguous.state.visibility = 'public'; ambiguous.config.allowPublicNotice = true; ambiguous.state.loseResponse = true;
  const unknown = await synchronizeIssues(ambiguous.args()); assert.equal(unknown.publication, 'UNKNOWN');
  assert.equal((await synchronizeIssues(ambiguous.args())).publication, 'UNKNOWN'); assert.equal(ambiguous.state.payloads.length, 1);
  const chosen = await synchronizeIssues(ambiguous.args({ config: { ...ambiguous.config, publicIssueId: ambiguous.state.issues[0].id } }));
  assert.equal(chosen.publication, 'SUCCEEDED'); assert.equal(chosen.counts.reconciled, 1); assert.equal(ambiguous.state.payloads.length, 1);
});
test('stale, expired, tampered or wrong-provenance proofs fail without provider calls; site verdict stays distinct', async t => {
  for (const overrides of [{ issuedAt: iso(-16 * 60000), observationStartedAt: iso(-20 * 60000) }, { sourceExpiresAt: iso(-1), expiresAt: iso(-1) }]) {
    const f = setup(t, 'github', overrides); const out = await synchronizeIssues(f.args()); assert.equal(out.diagnostic.code, 'ARTIFACT_INVALID'); assert.equal(out.exitCode, 3); assert.deepEqual(f.state.calls, []);
  }
  const f = setup(t); const out = await synchronizeIssues(f.args({ expected: { ...f.evidence.provenance, digest: '0'.repeat(64) } }));
  assert.equal(out.exitCode, 3); assert.equal(out.auditOutcome, 'GO'); assert.equal(f.state.calls.length, 0);
  const critical = setup(t, 'github', { verdict: { ...go, outcome: 'SITE_NO_GO', exitCode: 1, confirmedFindings: [{ ...finding('http.security.csp'), severity: 'critical' }] } });
  const pub = await synchronizeIssues(critical.args()); assert.equal(pub.auditExitCode, 1); assert.equal(pub.exitCode, 1);
});
test('filters and explicit shared-cause groups have stable identities independent of SHA/date/run; mapping conflicts require migration', async t => {
  const f = setup(t), base = candidates(f.evidence, f.config)[0].fingerprint;
  assert.equal(candidates({ ...f.evidence, provenance: { ...f.evidence.provenance, sha: 'f'.repeat(40), invocation: '999:4' } }, f.config)[0].fingerprint, base);
  assert.notEqual(candidates({ ...f.evidence, provenance: { ...f.evidence.provenance, environment: 'staging' } }, { ...f.config, environments: ['staging'] })[0].fingerprint, base);
  assert.deepEqual(candidates(f.evidence, { ...f.config, categories: ['seo'] }), []);
  const grouped = { ...f.config, groups: [{ id: 'shared-header', scopes: [go.fingerprints.scope, '9'.repeat(64)] }] };
  const another = { ...f.evidence, verdict: { ...go, fingerprints: { ...go.fingerprints, scope: '9'.repeat(64) } } };
  assert.equal(candidates(f.evidence, grouped)[0].fingerprint, candidates(another, grouped)[0].fingerprint);
  await synchronizeIssues(f.args()); const conflict = await synchronizeIssues(f.args({ config: grouped }));
  assert.equal(conflict.diagnostic.code, 'CONFIG_INVALID'); assert.equal(f.state.issues.length, 1);
  assert.throws(() => publicationConfiguration({ groups: [{ id: 'x', scopes: ['bad'] }] }));
  assert.throws(() => publicationConfiguration({ labels: ['@everyone\n::error::'] }));
});
test('a human decision racing with reopening wins atomically; no provider capability means no automatic reopen', async t => {
  const f = setup(t); await synchronizeIssues(f.args()); const issue = f.state.issues[0]; issue.state = 'closed';
  issue.decision = { kind: 'RESOLVED', authorized: true, actorId: '202', at: iso(-20000), until: null, version: 'resolved' };
  f.state.onReopen = async i => { i.decision = { ...i.decision, kind: 'ACCEPTED_RISK', version: 'accepted' }; i.revision = 'human'; };
  const raced = await synchronizeIssues(f.args({ config: { ...f.config, reopenResolved: true } })); assert.equal(raced.publication, 'FAILED'); assert.equal(issue.state, 'closed');
  f.state.conditionalReopen = false; const unsupported = await synchronizeIssues(f.args({ config: { ...f.config, reopenResolved: true } }));
  assert.equal(unsupported.diagnostic.code, 'CONFIG_INVALID'); assert.equal(f.state.calls.filter(c => c === 'reopen').length, 1);
});
test('definite write rejection is not replayed; unavailable journal/lease and malformed errors stay controlled', async t => {
  const f = setup(t); f.state.onCreate = async () => { throw new PublicationRejected('PUBLICATION_AUTH_FAILED'); };
  const rejected = await synchronizeIssues(f.args()); assert.equal(rejected.diagnostic.code, 'PUBLICATION_AUTH_FAILED'); assert.equal(f.journal().records.length, 0); assert.equal(f.state.payloads.length, 1);
  const malformed = setup(t); const bad = await synchronizeIssues(malformed.args({ adapter: { withDestinationLease: async () => { throw new Error('synthetic-private-738 secret'); } } }));
  assert.equal(bad.publication, 'UNKNOWN'); assert.ok(!JSON.stringify(bad).includes('synthetic-private-738'));
  const controller = new AbortController(); controller.abort(); const interrupted = await synchronizeIssues(malformed.args({ signal: controller.signal }));
  assert.equal(interrupted.publication, 'UNKNOWN'); assert.equal(malformed.state.payloads.length, 0);
});
test('lease fencing and per-write visibility are rechecked; lost ownership cannot authorize a later write', async t => {
  const f = setup(t); let checks = 0;
  const adapter = sessionPatch(f, s => ({ ...s, readDestination: async options => { if (++checks === 2) f.state.loseFence = true; return s.readDestination(options); } }));
  const lost = await synchronizeIssues(f.args({ adapter })); assert.equal(lost.publication, 'UNKNOWN'); assert.equal(f.state.payloads.length, 0);
  const changed = setup(t); let reads = 0;
  const moved = sessionPatch(changed, s => ({ ...s, readDestination: async options => { if (++reads === 2) changed.state.visibility = 'public'; return s.readDestination(options); } }));
  const invalid = await synchronizeIssues(changed.args({ adapter: moved })); assert.equal(invalid.diagnostic.code, 'DESTINATION_UNAVAILABLE'); assert.equal(changed.state.payloads.length, 0);
  assert.equal(changed.journal().records.length, 0);
  const falseLease = setup(t);
  const fake = await synchronizeIssues(falseLease.args({ adapter: { withDestinationLease: async () => ({ publication: 'SUCCEEDED', raw: 'synthetic-private-738' }) } }));
  assert.equal(fake.publication, 'UNKNOWN'); assert.ok(!JSON.stringify(fake).includes('synthetic-private-738'));
});
test('read retries respect Retry-After and global budget; no repeated mutation after temporary errors', async t => {
  const f = setup(t); let attempts = 0; const delays = [];
  const adapter = sessionPatch(f, s => ({ ...s, listIssues: async (...args) => {
    if (++attempts <= 2) throw new Failure('PUBLICATION_RATE_LIMITED', { transient: true, retryAfterSeconds: 2 }); return s.listIssues(...args);
  } }));
  const r = await synchronizeIssues(f.args({ adapter, sleep: async ms => delays.push(ms) }));
  assert.equal(r.publication, 'SUCCEEDED'); assert.deepEqual(delays, [2000, 2000]); assert.equal(f.state.payloads.length, 1);
  const limited = setup(t);
  const stops = sessionPatch(limited, s => ({ ...s, listIssues: async () => { throw new Failure('PUBLICATION_RATE_LIMITED', { transient: true, retryAfterSeconds: 10 }); } }));
  const stopped = await synchronizeIssues(limited.args({ adapter: stops, timeoutMs: 1000 })); assert.equal(stopped.publication, 'FAILED'); assert.equal(limited.state.payloads.length, 0);
});
test('a stalled adapter/lease cannot outlive the global deadline or trigger a late creation', { timeout: 3000 }, async t => {
  const f = setup(t); let canceled = false;
  const waiting = sessionPatch(f, s => ({ ...s, listIssues: (_cursor, options) => new Promise(() => { options.signal.addEventListener('abort', () => { canceled = true; }); }) }));
  const out = await synchronizeIssues(f.args({ adapter: waiting, timeoutMs: 10 }));
  assert.equal(out.publication, 'UNKNOWN'); assert.equal(canceled, true); assert.equal(f.state.payloads.length, 0);
  const hungLease = await synchronizeIssues(f.args({ adapter: { withDestinationLease: () => new Promise(() => {}) }, timeoutMs: 10 }));
  assert.equal(hungLease.publication, 'UNKNOWN'); assert.equal(f.state.payloads.length, 0);
});
