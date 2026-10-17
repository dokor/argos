import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { classify } from './changed-paths.mjs';

const workflow = readFileSync(new URL('../../.github/workflows/audit-security.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const gate = workflow.split('\n  security-result:\n')[1];
const bash = process.platform === 'win32' ? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Git/bin/bash.exe') : 'bash';

test('the required security context is static and distinct from both matrix workers', () => {
  const ruleset = JSON.parse(readFileSync(new URL('../../.github/main-ruleset.json', import.meta.url), 'utf8'));
  const required = ruleset.rules.find(rule => rule.type === 'required_status_checks').parameters.required_status_checks;
  const name = 'Audit egress and browser isolation';
  assert.ok(required.some(check => check.context === name));
  assert.equal(workflow.split(`    name: ${name}\n`).length - 1, 1);
  assert.ok(gate?.includes(`    name: ${name}\n`));
  assert.match(gate, /needs: \[changes, security\]/);
  for (const [arch, runner] of [['amd64', 'ubuntu-24.04'], ['arm64', 'ubuntu-24.04-arm']]) {
    assert.ok(workflow.includes(`- runner: ${runner}\n            arch: ${arch}\n            name: ${name} ${arch.toUpperCase()}`));
  }
  assert.match(workflow, /fail-fast: false/);
});

test('only a successful path classification outside the security scope can skip the static gate', () => {
  // always() is essential: a failed, cancelled or skipped dependency must reach
  // the gate instead of silently skipping the required context with the matrix.
  assert.ok(gate.includes("if: ${{ always() && (needs.changes.result != 'success' || needs.changes.outputs.security != 'false') }}"));
  assert.equal(classify(['apps/console-web/src/app/page.tsx']).security, false);
  assert.equal(classify(['README.md']).security, false);
  assert.equal(classify(['.github/workflows/audit-security.yml']).security, true);
  assert.equal(classify(null).security, true);
});

test('the actual gate command rejects failed, cancelled, skipped and missing dependency results', () => {
  const block = gate.split('        run: |\n')[1];
  assert.ok(block);
  const script = block.trimEnd().split('\n').map(line => line.slice(10)).join('\n');
  const results = ['success', 'failure', 'cancelled', 'skipped', ''];
  for (const changes of results) for (const security of results) {
    const result = spawnSync(bash, ['-e', '-c', script], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, CHANGES_RESULT: changes, SECURITY_REQUIRED: 'true', SECURITY_RESULT: security },
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status === 0, changes === 'success' && security === 'success', `${changes}/${security}: ${result.stderr}`);
  }
  for (const required of ['', 'false', 'unknown']) {
    const result = spawnSync(bash, ['-e', '-c', script], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, CHANGES_RESULT: 'success', SECURITY_REQUIRED: required, SECURITY_RESULT: 'success' },
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, `Unexpected security selection: ${required}`);
  }
});
