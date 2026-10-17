import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { REQUIRED_CHECKS } from '../check-release-evidence.mjs';

const dir = new URL('../../.github/workflows/', import.meta.url);
const read = name => readFileSync(new URL(name, dir), 'utf8').replaceAll('\r\n', '\n');
const ci = read('ci.yml');

test('PR controls share one classification and publish all existing required contexts', () => {
  assert.equal(ci.split('run: node scripts/ci/changed-paths.mjs').length - 1, 1);
  assert.ok(!ci.includes('workflow_call:'));
  assert.ok(!ci.includes('  push:'));
  assert.match(ci, /pull_request:\n    branches: \[main\]/);
  for (const name of REQUIRED_CHECKS.filter(name => name !== 'Secret scan')) {
    assert.ok(ci.includes(`    name: ${name}\n`) || name === 'auth' && ci.includes('\n  auth:\n'), `Missing required context: ${name}`);
  }
  assert.ok(read('secrets.yml').includes('    name: Secret scan\n'));
});

test('only deployment and secret commit scans run automatically on main pushes', () => {
  const pushes = readdirSync(dir).filter(name => read(name).includes('\n  push:')).sort();
  assert.deepEqual(pushes, ['deploy.yml', 'secrets.yml']);
  assert.match(ci, /workflow_dispatch:/);
  assert.match(ci, /schedule:\n    - cron: '0 4 \* \* \*'/);
});
