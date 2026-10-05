import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_CHECKS = [
  'API backend tests', 'Frontend checks', 'Lighthouse checks', 'Playwright checks',
  'MariaDB credentials (10.11)', 'MariaDB credentials (11.4)',
  'MariaDB progress (10.11)', 'MariaDB progress (11.4)',
  'Controlled audit E2E', 'Secret scan',
  'Production dependency audit (console-web)',
  'Production dependency audit (playwright-service)',
  'Production dependency audit (lighthouse-service)',
];
export const REQUIRED_GATES = {
  'private-api': 'OPERATIONS', 'secrets': 'REVIEW', 'audit-budget': 'OPERATIONS',
  'token-storage': 'REVIEW', 'public-write-limits': 'OPERATIONS',
  'publication-atomicity': 'OPERATIONS', 'score-comparability': 'REVIEW',
  'score-coverage': 'REVIEW', 'score-global': 'CODE', 'score-priorities': 'CODE',
  'backend-audit': 'REVIEW', 'accessibility-rules': 'REVIEW',
  'required-checks': 'REVIEW', 'e2e-modules-concurrency': 'OPERATIONS',
  'dependency-risk': 'REVIEW', 'backup-restore': 'OPERATIONS',
  'raspberry-post-deploy': 'OPERATIONS',
};

const text = value => typeof value === 'string' && value.trim().length > 0;
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const proofUrl = value => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port;
  } catch { return false; }
};
const record = value => value != null && typeof value === 'object' && !Array.isArray(value);

/** Validates declared evidence structure and revision consistency, never a human GO or proof authenticity. */
export function assessReleaseEvidence(evidence, expectedSha) {
  const blockers = [];
  if (!record(evidence)) return { status: 'NO_GO', blockers: ['invalid-document'] };
  if (evidence.schemaVersion !== 1) blockers.push('schema-version');
  if (!sha(expectedSha) || !sha(evidence.candidateSha) || evidence.candidateSha !== expectedSha)
    blockers.push('candidate-sha');
  if (!date(evidence.checkedAt)) blockers.push('checked-at');
  if (!text(evidence.environment)) blockers.push('environment');
  if (evidence.deployedSha !== expectedSha) blockers.push('deployed-sha');

  const checks = Array.isArray(evidence.ciChecks) ? evidence.ciChecks : [];
  for (const name of REQUIRED_CHECKS) {
    const matches = checks.filter(check => record(check) && check.name === name);
    const check = matches[0];
    if (matches.length !== 1 || check.sha !== expectedSha || check.conclusion !== 'success' || !proofUrl(check.url))
      blockers.push(`ci:${name}`);
  }
  if (checks.some(check => !record(check) || !REQUIRED_CHECKS.includes(check.name))) blockers.push('ci:unexpected-entry');

  const gates = Array.isArray(evidence.gates) ? evidence.gates : [];
  for (const [id, kind] of Object.entries(REQUIRED_GATES)) {
    const matches = gates.filter(gate => record(gate) && gate.id === id);
    const gate = matches[0];
    if (matches.length !== 1) { blockers.push(`gate:${id}:missing-or-duplicate`); continue; }
    if (gate.status === 'VERIFIED') {
      if (gate.kind !== kind || gate.sha !== expectedSha || !proofUrl(gate.url)
        || !text(gate.checkedBy) || !date(gate.checkedAt)) blockers.push(`gate:${id}:invalid-evidence`);
    } else if (gate.status === 'EXCLUDED') {
      const decision = gate.decision;
      if (!record(decision) || decision.sha !== expectedSha || !text(decision.decidedBy)
        || !date(decision.decidedAt) || !proofUrl(decision.url)
        || !text(decision.justification) || !text(decision.residualRisk)) blockers.push(`gate:${id}:invalid-exclusion`);
    } else blockers.push(`gate:${id}:unverified`);
  }
  if (gates.some(gate => !record(gate) || !Object.hasOwn(REQUIRED_GATES, gate.id))) blockers.push('gate:unexpected-entry');
  return { status: blockers.length ? 'NO_GO' : 'READY_FOR_HUMAN_REVIEW', blockers };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, flag, expectedSha, ...extra] = process.argv.slice(2);
  if (!file || flag !== '--sha' || !sha(expectedSha) || extra.length) {
    console.error('Usage: node scripts/check-release-evidence.mjs <evidence.json> --sha <40-character SHA>');
    process.exitCode = 2;
  } else {
    try {
      const result = assessReleaseEvidence(JSON.parse(readFileSync(file, 'utf8')), expectedSha);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.blockers.length ? 1 : 0;
    } catch {
      console.error('NO_GO: evidence file is unreadable or invalid JSON.');
      process.exitCode = 2;
    }
  }
}
