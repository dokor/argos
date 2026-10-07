import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { classify } from './changed-paths.mjs';

test('a frontend source change skips unrelated services and dependency audits', () => {
  assert.deepEqual(classify(['apps/console-web/src/app/page.tsx']), {
    api: false,
    frontend: true,
    playwright: false,
    lighthouse: false,
    e2e: true,
    dependency_frontend: false,
    dependency_playwright: false,
    dependency_lighthouse: false,
  });
});

test('backend changes run backend, MariaDB and integration checks', () => {
  const result = classify(['apps/api-backend/src/main/java/Example.java']);
  assert.equal(result.api, true);
  assert.equal(result.e2e, true);
  assert.equal(result.frontend, false);
  assert.equal(result.dependency_frontend, false);
});

test('a package lock change audits only its own service', () => {
  const result = classify(['apps/lighthouse-service/package-lock.json']);
  assert.equal(result.lighthouse, true);
  assert.equal(result.dependency_lighthouse, true);
  assert.equal(result.dependency_frontend, false);
  assert.equal(result.dependency_playwright, false);
});

test('CI changes and full runs exercise every check', () => {
  for (const paths of [['.github/workflows/ci.yml'], null]) {
    assert.ok(Object.values(classify(paths)).every(Boolean));
  }
});

test('documentation changes skip component checks', () => {
  assert.ok(Object.values(classify(['README.md'])).every((value) => value === false));
});

test('a main push runs every check for release evidence', () => {
  const output = join(tmpdir(), `argos-ci-paths-${randomUUID()}.txt`);
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./changed-paths.mjs', import.meta.url))], {
      env: { ...process.env, GITHUB_EVENT_NAME: 'push', GITHUB_OUTPUT: output, BASE_SHA: '', HEAD_SHA: '' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8').trim().split('\n').length, 8);
    assert.ok(readFileSync(output, 'utf8').trim().split('\n').every((line) => line.endsWith('=true')));
  } finally {
    try { unlinkSync(output); } catch { /* The assertion reports a missing output. */ }
  }
});
