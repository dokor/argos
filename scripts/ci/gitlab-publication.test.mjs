import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { main } from '../../clients/ci/src/client.mjs';
import { gitlabPublication } from '../../clients/ci/src/gitlab-publication.mjs';
import { PUBLIC_ISSUE } from '../../clients/ci/src/publication-policy.mjs';
import { VERSION } from '../../clients/ci/src/resources.mjs';
import { fixture, now, iso, destination, configuration, provenance, verdict, evidence, readToken, writeToken } from './fixtures/gitlab-publication.mjs';
test('GitLab source is proven by current pipeline API/trace, encrypted evidence and authenticated private journal; rerun creates once', async t => {
  const f = fixture(t); await f.prepare(); const result = await f.publish();
  assert.equal(result.counts.created, 1); assert.equal(result.exitCode, 0); assert.equal(f.state.posts[0].confidential, true);
  assert.equal((await f.publish({ CI_JOB_ID: '791' })).counts.unchanged, 1); assert.equal(f.state.attempts, 1); assert.equal(f.state.lease, null);
  assert.equal(fs.existsSync(join(f.root, 'publisher/evidence.json')), false); assert.doesNotMatch(JSON.stringify(result), /glpat-|nonce|http.security/);
});
test('GitLab SITE_NO_GO still publishes but a technical producer cannot emit a finding', async t => {
  const f = fixture(t, configuration, { ...evidence, verdict: { ...verdict, outcome: 'SITE_NO_GO', exitCode: 1,
    confirmedFindings: verdict.confirmedFindings.map(v => ({ ...v, severity: 'critical' })) } });
  await f.prepare(); const result = await f.publish(); assert.equal(result.exitCode, 1); assert.equal(result.counts.created, 1);
  const technical = fixture(t); technical.state.trace = JSON.stringify({ clientVersion: VERSION, command: 'audit', auditOutcome: 'CONTROL_FAILED',
    auditExitCode: 2, exitCode: 2, diagnostic: { code: 'MEASUREMENT_INCOMPLETE' } });
  const failed = await technical.publish({ ARGOS_GITLAB_PUBLISH_TOKEN: undefined, ARGOS_GITLAB_JOURNAL_SAS_URL: undefined });
  assert.equal(failed.exitCode, 2); assert.equal(failed.publication, 'DISABLED'); assert.equal(technical.state.attempts, 0);
});
test('lost/invisible GitLab creation stays durably prepared and never posts again after another job', async t => {
  const f = fixture(t); await f.prepare(); f.state.lose = true; f.state.hide = true;
  assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.envelope.journal.records[0].phase, 'CREATE_PENDING');
  assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.attempts, 1);
  f.state.hide = false; assert.equal((await f.publish()).counts.reconciled, 1); assert.equal(f.state.attempts, 1);
});
test('public GitLab creates one strictly generic non-confidential notice with no finding metadata', async t => {
  const input = { ...configuration, destination: { ...destination, visibility: 'public' }, allowPrivateDetails: false, allowPublicNotice: true };
  const f = fixture(t, input); await f.prepare(); assert.equal((await f.publish()).counts.created, 1);
  assert.deepEqual(f.state.posts, [{ title: PUBLIC_ISSUE.title, description: PUBLIC_ISSUE.body, labels: '', confidential: false, issue_type: 'issue' }]);
  assert.equal((await f.publish()).counts.unchanged, 1);
});
test('GitLab human content/labels/assignees and every closure persist; reopening is rejected', async t => {
  const f = fixture(t); await f.prepare(); await f.publish(); const issue = f.state.issues[0];
  issue.description = 'Human notes\n' + issue.description; issue.labels.push('argos:accepted-risk'); issue.assignees = [{ id: 303 }];
  const before = structuredClone(issue); assert.equal((await f.publish()).counts.suppressed, 1); assert.deepEqual(issue, before);
  issue.labels = []; issue.state = 'closed'; assert.equal((await f.publish()).counts.suppressed, 1);
  assert.equal((await f.publish({ ARGOS_PUBLICATION_CONFIG: JSON.stringify({ ...configuration, reopenResolved: true }) })).diagnostic.code, 'CONFIG_INVALID');
  assert.ok(f.state.calls.every(c => c.method !== 'PATCH' && !(c.origin === 'https://gitlab.com' && c.method === 'PUT')));
});
test('dedicated identity is explicit and must be a non-admin member of this project alone', async t => {
  const f = fixture(t); f.state.bot = false; await f.prepare();
  assert.equal((await f.publish()).diagnostic.code, 'PUBLICATION_AUTH_FAILED');
  const explicit = { ARGOS_GITLAB_CREDENTIAL_KIND: 'dedicated-user' }; assert.equal((await f.publish(explicit)).counts.created, 1);
  f.state.foreignMember = true; assert.equal((await f.publish(explicit)).diagnostic.code, 'PUBLICATION_AUTH_FAILED'); assert.equal(f.state.attempts, 1);
});
test('destination PREVIEW uses only read_api and SAS r; no mutation or lease', async t => {
  const f = fixture(t, { ...configuration, mode: 'PREVIEW' }); await f.prepare();
  const result = await f.publish({ ARGOS_GITLAB_PUBLISH_TOKEN: undefined }); assert.equal(result.publication, 'PREVIEW'); assert.equal(result.counts.created, 1);
  assert.ok(f.state.calls.every(c => ['GET', 'HEAD'].includes(c.method))); assert.equal(f.state.attempts, 0);
});
for (const [field, value] of [['role', 40], ['identity', 303], ['writeScopes', ['api', 'sudo']], ['tokenActive', false],
  ['tokenRevoked', true], ['tokenExpiry', '2026-10-18'], ['visibility', 'public'], ['archived', true], ['issuesAccess', 'disabled'], ['keepLatest', true]]) {
  test(`GitLab refuses current credential/destination drift: ${field}`, async t => {
    const f = fixture(t); await f.prepare(); f.state[field] = value; const result = await f.publish();
    assert.equal(result.exitCode, 3); assert.equal(f.state.attempts, 0); assert.doesNotMatch(JSON.stringify(result), /synthetic-private|glpat-/);
  });
}
test('source job, artifact lifetime, trace seal and hashes cannot be substituted or trusted from the artifact', async t => {
  const f = fixture(t); await f.prepare();
  for (const change of [{ erased_at: iso(0) }, { commit: { id: '0'.repeat(40) } }, { ref: 'feature' }, { artifacts_expire_at: iso(-1) },
    { pipeline: { id: 124, project_id: 42, sha: provenance.sha } }, { pipeline: { id: 123, project_id: 43, sha: provenance.sha } }]) {
    f.state.sourceChange = change; assert.equal((await f.publish()).exitCode, 3);
  }
  f.state.sourceChange = null; const trace = f.state.trace;
  f.state.trace = trace + trace; assert.equal((await f.publish()).diagnostic.code, 'ARTIFACT_INVALID');
  f.state.trace = trace.replace(/"cipherSha256":"[a-f0-9]{64}"/, '"cipherSha256":"' + '0'.repeat(64) + '"');
  assert.equal((await f.publish()).diagnostic.code, 'ARTIFACT_INVALID'); f.state.trace = '';
  assert.equal((await f.publish()).diagnostic.code, 'ARTIFACT_INVALID'); assert.equal(f.state.attempts, 0);
});
test('complete job/issue pagination is mandatory and foreign links stop before creation', async t => {
  const f = fixture(t); await f.prepare(); f.state.jobPages = [[{ ...f.source(), id: 1, name: 'another' }], [f.source()]];
  assert.equal((await f.publish()).counts.created, 1);
  f.state.corruptPage = true; assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.attempts, 1);
  const item = f.state.issues[0]; item.author.id = 999; f.state.corruptPage = false;
  assert.equal((await f.publish()).publication, 'UNKNOWN'); assert.equal(f.state.attempts, 1);
});
for (const [status, code] of [[401, 'PUBLICATION_AUTH_FAILED'], [403, 'DESTINATION_UNAVAILABLE'], [404, 'DESTINATION_UNAVAILABLE'],
  [429, 'PUBLICATION_RATE_LIMITED'], [503, 'PUBLICATION_STATE_UNKNOWN']]) {
  test(`GitLab HTTP ${status} remains controlled without provider prose`, async t => {
    const f = fixture(t); f.state.status = status; const result = await f.stage(); assert.equal(result.diagnostic.code, code);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-private|::error::|glpat-/); assert.equal(f.state.attempts, 0);
  });
}
test('definite GitLab POST rejection does not retry; ambiguous 5xx never permits another POST', async t => {
  for (const status of [401, 403, 422, 429, 503]) {
    const f = fixture(t); await f.prepare(); f.state.postStatus = status;
    assert.equal((await f.publish()).exitCode, 3); assert.equal(f.state.attempts, 1);
    assert.equal(f.state.envelope.journal.records.length, status === 503 ? 1 : 0);
    if (status === 503) { await f.publish(); assert.equal(f.state.attempts, 1); }
  }
});
test('GitLab refuses MR/fork context, another origin/project, misplaced secrets and CI_JOB_TOKEN fallback', async t => {
  const f = fixture(t);
  for (const env of [{ CI_SERVER_URL: 'https://self-managed.invalid' }, { CI_API_V4_URL: 'https://elsewhere.invalid' }, { CI_PROJECT_ID: '43' },
    { CI_MERGE_REQUEST_IID: '123' }, { ARGOS_API_KEY: 'forbidden' }]) assert.throws(() => gitlabPublication(configuration,
      { ...f.env, ARGOS_GITLAB_PUBLISH_TOKEN: writeToken, ...env }), { code: 'CONFIG_INVALID' });
  assert.throws(() => gitlabPublication(configuration, { ...f.env, CI_JOB_TOKEN: writeToken }), { code: 'PUBLICATION_AUTH_FAILED' });
  const off = await main(['publish-gitlab'], { ...f.env, ARGOS_PUBLICATION_CONFIG: '{}' }, { now, fetcher: () => assert.fail('disabled I/O') });
  assert.equal(off.publication, 'DISABLED'); assert.equal(off.exitCode, 0);
  const misplaced = await main(['publication-stage'], { ...f.env, ARGOS_GITLAB_PUBLISH_TOKEN: writeToken }, { now, fetcher: () => assert.fail('write token in control') });
  assert.equal(misplaced.diagnostic.code, 'CONFIG_INVALID');
  const audit = await main(['audit'], { ...f.env, ARGOS_API_KEY: 'argos_ci_' + 'a'.repeat(32) + '.' + 'b'.repeat(43),
    ARGOS_TARGET_URL: 'https://example.com', ARGOS_GITLAB_PUBLISH_TOKEN: writeToken }, { now, fetcher: () => assert.fail('write credential in audit') });
  assert.equal(audit.diagnostic.code, 'CONFIG_INVALID'); assert.equal(audit.exitCode, 2);
});
test('a replaced/technical control after durable preparation blocks the GitLab POST while preserving the original audit', async t => {
  const f = fixture(t); await f.prepare();
  f.state.onSave = () => { if (f.state.envelope.journal.records.some(r => r.phase === 'CREATE_PENDING')) {
    f.state.trace = JSON.stringify({ clientVersion: VERSION, command: 'audit', auditOutcome: 'CONTROL_FAILED', auditExitCode: 2,
      exitCode: 2, diagnostic: { code: 'MEASUREMENT_INCOMPLETE' } });
  } };
  const result = await f.publish(); assert.equal(result.exitCode, 3); assert.equal(result.auditExitCode, 0);
  assert.equal(result.diagnostic.code, 'ARTIFACT_INVALID'); assert.equal(f.state.attempts, 0);
  assert.equal(f.state.envelope.journal.records.length, 0);
});
