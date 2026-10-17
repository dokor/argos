import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createSupervisedCollector } from './supervisor.mjs';

async function fixture(t, options = {}) {
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, 'argos-supervisor-test-'));
  assert.equal(dirname(resolve(root)), base);
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  return { root, collect: createSupervisedCollector({
    temporaryRoot: root, workerFile: new URL('./fixtures/worker-fixture.mjs', import.meta.url), ...options
  }) };
}

test('results are bounded, workers cannot inherit credentials, and scratch is removed before returning', async t => {
  const before = process.env.ARGOS_TEST_SECRET;
  process.env.ARGOS_TEST_SECRET = 'fixture-secret-do-not-inherit';
  t.after(() => { if (before === undefined) delete process.env.ARGOS_TEST_SECRET; else process.env.ARGOS_TEST_SECRET = before; });
  const { root, collect } = await fixture(t);
  const result = await collect('https://example.com/ok');
  assert.equal(result.lhr.categories.accessibility.score, 1);
  assert.equal(result.lhr.hasSecret, false);
  assert.deepEqual(await readdir(root), []);
});

test('an unhandled worker rejection cannot crash the server and the next audit succeeds', async t => {
  const { root, collect } = await fixture(t);
  await assert.rejects(collect('https://example.com/crash'), error => error.message === 'Collector unavailable');
  assert.deepEqual(await readdir(root), []);
  assert.equal((await collect('https://example.com/ok')).lhr.categories.accessibility.score, 1);
});

test('deadline and client abort stop work and remove its files before releasing admission', async t => {
  const { root, collect } = await fixture(t);
  await assert.rejects(collect('https://example.com/hang', { timeoutMs: 300 }), /Analysis timeout/);
  assert.deepEqual(await readdir(root), []);
  const controller = new AbortController();
  const pending = collect('https://example.com/hang', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending);
  assert.deepEqual(await readdir(root), []);
  assert.equal((await collect('https://example.com/ok')).lhr.categories.accessibility.score, 1);
});

test('overflow and forbidden targets fail without exposing child diagnostics or leaving files', async t => {
  const { root, collect } = await fixture(t, { maxResultBytes: 1024 });
  await assert.rejects(collect('https://example.com/large'), /Collector unavailable/);
  await assert.rejects(collect('http://127.0.0.1/'), /Target blocked/);
  assert.deepEqual(await readdir(root), []);
});

test('completion kills a descendant left alive by the worker', async t => {
  const { collect } = await fixture(t);
  const pid = (await collect('https://example.com/descendant')).lhr.childPid;
  const alive = async () => {
    try {
      process.kill(pid, 0);
      if (process.platform === 'linux') {
        const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
        return !stat.slice(stat.lastIndexOf(')') + 2).startsWith('Z');
      }
      return true;
    } catch { return false; }
  };
  for (let i = 0; i < 100 && await alive(); i++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(await alive(), false);
});
