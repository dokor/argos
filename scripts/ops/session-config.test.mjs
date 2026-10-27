import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, statSync, chmodSync, symlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { sessionConfig } from './session-config.mjs';
import { safeSettings, settingsAre24h, assertOperationContext } from './production-sessions.mjs';

const backup = 'prod.conf.sessions-123-1-0123456789abcdef.bak';
function fixture(work) {
  const directory = mkdtempSync(join(tmpdir(), 'argos-session-unit-'));
  const path = join(directory, 'prod.conf');
  const original = 'account { session-ttl = 12h, idle-ttl = 30m, jwt-secret = "synthetic-private-value" }\n';
  writeFileSync(path, original); chmodSync(path, 0o640);
  try { work({ directory, path, original }); }
  finally { if (dirname(directory) === resolve(tmpdir())) rmSync(directory, { recursive: true, force: true }); }
}
test('preserves the complete config in a private backup and restores the original bytes', () => fixture(({ directory, path, original }) => {
  const applied = sessionConfig(directory, backup, 'apply');
  assert.equal(applied.changed, true);
  assert.equal(readFileSync(join(directory, backup), 'utf8'), original);
  assert.ok(readFileSync(path, 'utf8').startsWith(original));
  assert.match(readFileSync(path, 'utf8'), /account\.session-ttl = 24h\naccount\.idle-ttl = 24h\n$/);
  assert.ok(!JSON.stringify(applied).includes('synthetic-private-value'));
  if (process.platform !== 'win32') {
    assert.equal(statSync(join(directory, backup)).mode & 0o777, 0o600);
    assert.equal(statSync(path).mode & 0o777, 0o640);
  }
  sessionConfig(directory, backup, 'restore');
  assert.equal(readFileSync(path, 'utf8'), original);
}));
test('is idempotent and never overwrites an existing backup', () => fixture(({ directory, path, original }) => {
  writeFileSync(join(directory, backup), 'existing-backup');
  assert.throws(() => sessionConfig(directory, backup, 'apply'));
  assert.equal(readFileSync(path, 'utf8'), original);
  const other = backup.replace('123-', '124-');
  sessionConfig(directory, other, 'apply');
  assert.deepEqual(sessionConfig(directory, backup, 'apply'), { changed: false });
  assert.equal(readFileSync(join(directory, backup), 'utf8'), 'existing-backup');
}));
test('rejects arbitrary operations and paths before modifying the file', () => fixture(({ directory, path, original }) => {
  for (const name of ['../outside.bak', '/outside.bak', 'prod.conf', 'prod.conf.sessions-1-1-secret.bak']) {
    assert.throws(() => sessionConfig(directory, name, 'apply'));
  }
  assert.throws(() => sessionConfig(directory, backup, 'delete'));
  assert.equal(readFileSync(path, 'utf8'), original);
  assert.equal(existsSync(join(directory, backup)), false);
}));
test('refuses symlinked production configuration', { skip: process.platform === 'win32' }, () => fixture(({ directory, original }) => {
  const alternate = join(directory, 'target.conf'); writeFileSync(alternate, original);
  rmSync(join(directory, 'prod.conf'));
  symlinkSync(alternate, join(directory, 'prod.conf'));
  assert.throws(() => sessionConfig(directory, backup, 'apply'));
  assert.equal(readFileSync(alternate, 'utf8'), original);
}));
test('whitelists observed durations and requires actual 24h limits', () => {
  const data = { sessionSeconds: 86400, idleSeconds: 86400, jwtSeconds: 900, recentSeconds: 300 };
  assert.deepEqual(safeSettings({ ...data, jwtSecret: 'never-publish' }), data);
  assert.equal(settingsAre24h(data), true);
  assert.equal(settingsAre24h({ ...data, idleSeconds: 1800 }), false);
  assert.throws(() => safeSettings({ ...data, sessionSeconds: '86400' }));
});
test('production operations require trusted main, explicit revision and existing CI credentials', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'dokor/argos',
    EXPECTED_REVISION: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', ARGOS_CI_EMAIL: 'synthetic', ARGOS_CI_PASSWORD: 'synthetic' };
  assertOperationContext(env, []); assertOperationContext(env, ['--apply-24h']);
  for (const changes of [{ GITHUB_ACTIONS: '' }, { GITHUB_REF: 'refs/pull/1/merge' }, { GITHUB_REPOSITORY: 'untrusted/fork' },
    { EXPECTED_REVISION: 'main' }, { ARGOS_CI_PASSWORD: '' }, { GITHUB_RUN_ID: '../bad' }]) {
    assert.throws(() => assertOperationContext({ ...env, ...changes }, []));
  }
  assert.throws(() => assertOperationContext(env, ['--command=anything']));
});
