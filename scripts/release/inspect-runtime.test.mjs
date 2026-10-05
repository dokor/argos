import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRuntime, SERVICES } from './inspect-runtime.mjs';

const SHA = 'a'.repeat(40);
const ID = 'b'.repeat(64);
const IMAGE = 'sha256:' + 'c'.repeat(64);
const SECRET = 'synthetic-do-not-publish';
function fixture({ revision = SHA, health = 'healthy', state = 'running', changed = false,
  healthChanged = false, fail = false, stats = { CPUPerc: '3.5%', MemUsage: '128MiB / 1GiB' } } = {}) {
  let inspections = 0;
  return args => {
    assert.ok(['container', 'image', 'stats'].includes(args[0]));
    if (fail) throw new Error(SECRET);
    if (args[0] === 'container') {
      inspections++;
      return JSON.stringify([{ Id: changed && inspections % 2 === 0 ? 'd'.repeat(64) : ID, Image: IMAGE,
        State: { Status: state, Health: { Status: healthChanged && inspections % 2 === 0 ? 'unhealthy' : health }, StartedAt: '2026-10-05T00:00:00Z', OOMKilled: false },
        RestartCount: 0, Config: { Env: [SECRET], Labels: { private: SECRET } }, Mounts: [SECRET] }]);
    }
    if (args[0] === 'image') {
      assert.equal(args[2], IMAGE); // actual immutable image ID, not a mutable tag
      return JSON.stringify([{ Id: IMAGE, Architecture: 'arm64', Config: {
        Env: [SECRET], Labels: { 'org.opencontainers.image.revision': revision, secret: SECRET } } }]);
    }
    assert.equal(args.at(-1), ID);
    return JSON.stringify({ ...stats, unexpectedSecret: SECRET });
  };
}
test('four actual image IDs are compared, with resource samples and no secret fields', () => {
  const result = inspectRuntime(SHA, { docker: fixture() });
  assert.equal(result.revisionStatus, 'MATCH'); assert.equal(result.healthStatus, 'HEALTHY');
  assert.deepEqual(result.blockers, []); assert.deepEqual(result.services.map(s => s.service), SERVICES);
  assert.equal(result.services[0].memoryBytes, 128 * 1024 ** 2);
  assert.equal(result.services[0].memoryLimitBytes, 1024 ** 3);
  assert.equal(result.services[0].cpuPercent, 3.5);
  assert.ok(!JSON.stringify(result).includes(SECRET)); assert.equal(result.releaseGo, undefined);
});
test('missing/legacy labels and different revisions stay unverified', () => {
  for (const revision of ['unknown', undefined, 'd'.repeat(40), SECRET]) {
    const result = inspectRuntime(SHA, { docker: fixture({ revision: revision ?? null }) });
    assert.equal(result.revisionStatus, 'UNVERIFIED'); assert.ok(result.blockers.length);
    assert.ok(!JSON.stringify(result).includes(SECRET));
  }
});
test('missing healthchecks do not become healthy, even when revisions match', () => {
  const missing = inspectRuntime(SHA, { docker: fixture({ health: null }) });
  assert.equal(missing.healthStatus, 'UNVERIFIED');
});
test('a stopped or unhealthy container is not healthy', () => {
  for (const options of [{ state: 'exited' }, { health: 'unhealthy' }])
    assert.equal(inspectRuntime(SHA, { docker: fixture(options) }).healthStatus, 'UNHEALTHY_OR_UNAVAILABLE');
});
test('container replacement during inspection invalidates the observation', () => {
  const result = inspectRuntime(SHA, { docker: fixture({ changed: true }) });
  assert.equal(result.revisionStatus, 'UNVERIFIED');
  assert.ok(result.blockers.some(b => b.endsWith('container-changed-during-observation')));
});
test('health changing during collection is not certified healthy', () => {
  const result = inspectRuntime(SHA, { docker: fixture({ healthChanged: true }) });
  assert.equal(result.revisionStatus, 'UNVERIFIED'); assert.equal(result.healthStatus, 'UNVERIFIED');
  assert.ok(result.blockers.some(b => b.endsWith('container-changed-during-observation')));
});
test('Docker failures are retained as generic blockers, never raw stderr', () => {
  const result = inspectRuntime(SHA, { docker: fixture({ fail: true }) });
  assert.equal(result.revisionStatus, 'UNVERIFIED'); assert.equal(result.services.length, 4);
  assert.ok(!JSON.stringify(result).includes(SECRET));
});
test('unknown resource formats do not produce invented measurements', () => {
  const result = inspectRuntime(SHA, { docker: fixture({ stats: { CPUPerc: SECRET, MemUsage: SECRET } }) });
  assert.equal(result.services[0].cpuPercent, null); assert.equal(result.services[0].memoryBytes, null);
  assert.ok(result.blockers.some(b => b.endsWith('resources-unavailable')));
  assert.ok(!JSON.stringify(result).includes(SECRET));
});
test('invalid expected revision is rejected before any Docker access', () => {
  assert.throws(() => inspectRuntime('main', { docker: () => assert.fail('Docker must not run') }));
});
