import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessReleaseEvidence, REQUIRED_CHECKS, REQUIRED_GATES } from './check-release-evidence.mjs';

const SHA = '4286079b3d28bf035fdd1bd1c220f1f72d423d81';
const OTHER_SHA = 'a'.repeat(40);
const PROOF_URL = 'https://github.com/dokor/argos/issues/259';
function complete() {
  return {
    schemaVersion: 1, candidateSha: SHA, deployedSha: SHA, environment: 'isolated-reference', checkedAt: '2026-10-05',
    ciChecks: REQUIRED_CHECKS.map(name => ({ name, sha: SHA, conclusion: 'success', url: PROOF_URL })),
    gates: Object.entries(REQUIRED_GATES).map(([id, kind]) => ({ id, kind, status: 'VERIFIED', sha: SHA,
      url: PROOF_URL, checkedBy: 'synthetic-reviewer', checkedAt: '2026-10-05' })),
  };
}

test('a complete synthetic dossier only becomes ready for human review, never GO', () => {
  assert.deepEqual(assessReleaseEvidence(complete(), SHA), { status: 'READY_FOR_HUMAN_REVIEW', blockers: [] });
});
test('the historical snapshot stays NO_GO under the current CI contract', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../docs/release/v1-evidence-2026-10-05.json', import.meta.url)));
  const result = assessReleaseEvidence(snapshot, snapshot.candidateSha);
  assert.equal(result.status, 'NO_GO');
  assert.ok(result.blockers.includes('gate:private-api:unverified'));
  assert.ok(result.blockers.includes('gate:accessibility-rules:unverified'));
  assert.ok(result.blockers.includes('ci:MariaDB integration (11.4)'));
  assert.ok(result.blockers.includes('ci:unexpected-entry'));
});
test('closing coordination with deferred validation does not certify technical readiness', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../docs/release/v1-evidence-2026-10-05.json', import.meta.url)));
  assert.equal(snapshot.coordinationDecision.status, 'CLOSED_WITH_DEFERRED_VALIDATION');
  assert.equal(snapshot.coordinationDecision.productionDeploymentAuthorized, false);
  const result = assessReleaseEvidence(snapshot, snapshot.candidateSha);
  assert.equal(result.status, 'NO_GO');
  assert.ok(result.blockers.includes('gate:secrets:unverified'));
  assert.ok(result.blockers.includes('gate:accessibility-rules:unverified'));
});
for (const name of REQUIRED_CHECKS) {
  test(`a missing, failing, duplicated or stale CI check blocks: ${name}`, () => {
    for (const mutation of [
      evidence => { evidence.ciChecks = evidence.ciChecks.filter(check => check.name !== name); },
      evidence => { evidence.ciChecks.find(check => check.name === name).conclusion = 'skipped'; },
      evidence => { evidence.ciChecks.find(check => check.name === name).sha = OTHER_SHA; },
      evidence => { evidence.ciChecks.push(evidence.ciChecks.find(check => check.name === name)); },
    ]) {
      const evidence = complete(); mutation(evidence);
      assert.ok(assessReleaseEvidence(evidence, SHA).blockers.includes(`ci:${name}`));
    }
  });
}
test('candidate or deployed revision divergence invalidates the dossier', () => {
  const evidence = complete();
  evidence.deployedSha = OTHER_SHA;
  assert.ok(assessReleaseEvidence(evidence, SHA).blockers.includes('deployed-sha'));
  assert.ok(assessReleaseEvidence(complete(), OTHER_SHA).blockers.includes('candidate-sha'));
});
test('all gates remain required even when removed from the JSON', () => {
  for (const id of Object.keys(REQUIRED_GATES)) {
    const evidence = complete(); evidence.gates = evidence.gates.filter(gate => gate.id !== id);
    assert.ok(assessReleaseEvidence(evidence, SHA).blockers.includes(`gate:${id}:missing-or-duplicate`));
  }
});
test('code or CI evidence cannot replace an operations check', () => {
  const evidence = complete(); evidence.gates.find(gate => gate.id === 'publication-atomicity').kind = 'CODE';
  assert.ok(assessReleaseEvidence(evidence, SHA).blockers.includes('gate:publication-atomicity:invalid-evidence'));
});
test('exclusions require a dated human decision, exact SHA and residual risk', () => {
  const evidence = complete(); const gate = evidence.gates[0];
  gate.status = 'EXCLUDED';
  assert.ok(assessReleaseEvidence(evidence, SHA).blockers.includes('gate:private-api:invalid-exclusion'));
  gate.decision = { sha: SHA, decidedBy: 'synthetic-maintainer', decidedAt: '2026-10-05', url: PROOF_URL,
    justification: 'Synthetic reduced scope', residualRisk: 'Synthetic accepted risk' };
  assert.equal(assessReleaseEvidence(evidence, SHA).status, 'READY_FOR_HUMAN_REVIEW');
  for (const field of Object.keys(gate.decision)) {
    const invalid = structuredClone(evidence); delete invalid.gates[0].decision[field];
    assert.ok(assessReleaseEvidence(invalid, SHA).blockers.includes('gate:private-api:invalid-exclusion'));
  }
});
test('invalid, duplicate, unknown or incomplete records fail closed', () => {
  for (const mutation of [
    evidence => { evidence.schemaVersion = 2; },
    evidence => { evidence.environment = ''; },
    evidence => { evidence.checkedAt = '2026-02-30'; },
    evidence => { evidence.gates[0].checkedBy = ''; },
    evidence => { evidence.gates[0].url = 'javascript:alert(1)'; },
    evidence => { evidence.gates[0].sha = OTHER_SHA; },
    evidence => { evidence.gates.push(evidence.gates[0]); },
    evidence => { evidence.gates.push({ id: 'unknown' }); },
    evidence => { evidence.ciChecks.push(null); },
    evidence => { evidence.gates = null; },
  ]) {
    const evidence = complete(); mutation(evidence);
    assert.equal(assessReleaseEvidence(evidence, SHA).status, 'NO_GO');
  }
  for (const value of [null, [], {}, true]) assert.equal(assessReleaseEvidence(value, SHA).status, 'NO_GO');
});
test('CLI propagates NO_GO and argument/file errors to its exit status', () => {
  const script = new URL('./check-release-evidence.mjs', import.meta.url);
  const snapshot = new URL('../docs/release/v1-evidence-2026-10-05.json', import.meta.url);
  const run = args => spawnSync(process.execPath, [fileURLToPath(script), ...args], { encoding: 'utf8' });
  assert.equal(run([fileURLToPath(snapshot), '--sha', SHA]).status, 1);
  assert.equal(run([fileURLToPath(snapshot)]).status, 2);
  assert.equal(run(['missing-evidence.json', '--sha', SHA]).status, 2);
});

