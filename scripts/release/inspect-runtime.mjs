import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SERVICES = ['api-backend', 'console-web', 'playwright-service', 'lighthouse-service'];
const SHA = /^[a-f0-9]{40}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const ID = /^[a-f0-9]{64}$/;
const STATES = new Set(['running', 'created', 'restarting', 'removing', 'paused', 'exited', 'dead']);
const HEALTH = new Set(['healthy', 'unhealthy', 'starting']);
const units = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4,
  kB: 1000, KB: 1000, MB: 1e6, GB: 1e9, TB: 1e12 };
const bytes = value => {
  const match = typeof value === 'string' && value.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KiB|MiB|GiB|TiB|kB|KB|MB|GB|TB)$/);
  return match ? Math.round(Number(match[1]) * units[match[2]]) : null;
};
const unknown = service => ({ service, containerId: null, imageId: null, revision: null,
  revisionMatches: false, architecture: null, state: 'unknown', health: 'not-configured',
  oomKilled: null, restartCount: null, cpuPercent: null, memoryBytes: null, memoryLimitBytes: null });
const runDocker = args => execFileSync('docker', args, { encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 1024 * 1024 });
const one = value => {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0]) throw new Error('Invalid Docker result');
  return parsed[0];
};

/** Read-only Docker observation. Whitelist output fields; never emit env, logs, config or stderr. */
export function inspectRuntime(expectedSha, { docker = runDocker, now = () => new Date() } = {}) {
  if (!SHA.test(expectedSha)) throw new Error('A full lowercase revision is required');
  const evidence = { schemaVersion: 1, kind: 'RUNTIME_OBSERVATION', checkedAt: now().toISOString(),
    expectedSha, revisionStatus: 'UNVERIFIED', healthStatus: 'UNVERIFIED',
    services: [], limitations: ['Point-in-time sample; no load test, functional audit, database restore or release GO.'], blockers: [] };
  for (const service of SERVICES) {
    const result = unknown(service);
    const block = reason => evidence.blockers.push(`${service}:${reason}`);
    try {
      const container = one(docker(['container', 'inspect', service]));
      if (!ID.test(container.Id) || !IMAGE.test(container.Image)) throw new Error('Invalid container identity');
      result.containerId = container.Id;
      result.imageId = container.Image;
      result.state = STATES.has(container.State?.Status) ? container.State.Status : 'unknown';
      result.health = HEALTH.has(container.State?.Health?.Status) ? container.State.Health.Status : 'not-configured';
      result.oomKilled = typeof container.State?.OOMKilled === 'boolean' ? container.State.OOMKilled : null;
      result.restartCount = Number.isSafeInteger(container.RestartCount) && container.RestartCount >= 0 ? container.RestartCount : null;
      const image = one(docker(['image', 'inspect', container.Image]));
      if (image.Id !== container.Image) throw new Error('Image identity differs');
      const revision = image.Config?.Labels?.['org.opencontainers.image.revision'];
      result.revision = SHA.test(revision) ? revision : null;
      result.revisionMatches = result.revision === expectedSha;
      result.architecture = ['arm64', 'amd64', 'arm', '386'].includes(image.Architecture) ? image.Architecture : null;
      try {
        const stats = JSON.parse(docker(['stats', '--no-stream', '--format', '{{json .}}', container.Id]));
        const cpu = typeof stats.CPUPerc === 'string' && stats.CPUPerc.match(/^(\d+(?:\.\d+)?)%$/);
        result.cpuPercent = cpu ? Number(cpu[1]) : null;
        const memory = typeof stats.MemUsage === 'string' ? stats.MemUsage.split('/') : [];
        if (memory.length === 2) { result.memoryBytes = bytes(memory[0]); result.memoryLimitBytes = bytes(memory[1]); }
        if (result.cpuPercent == null || result.memoryBytes == null || result.memoryLimitBytes == null) block('resources-unavailable');
      } catch { block('resources-unavailable'); }
      const after = one(docker(['container', 'inspect', service]));
      if (after.Id !== container.Id || after.Image !== container.Image
        || after.State?.StartedAt !== container.State?.StartedAt || after.State?.Status !== container.State?.Status
        || after.State?.Health?.Status !== container.State?.Health?.Status
        || after.State?.OOMKilled !== container.State?.OOMKilled || after.RestartCount !== container.RestartCount) {
        result.revisionMatches = false;
        block('container-changed-during-observation');
        result.health = 'unknown';
      }
      if (!result.revisionMatches) block('revision-mismatch-or-unknown');
      if (result.state !== 'running') block('not-running');
      if (result.health === 'unhealthy') block('unhealthy');
      if (result.oomKilled) block('oom-killed');
      if (!result.architecture) block('architecture-unknown');
    } catch { block('inspect-unavailable'); result.revisionMatches = false; }
    evidence.services.push(result);
  }
  evidence.revisionStatus = evidence.services.every(service => service.revisionMatches) ? 'MATCH' : 'UNVERIFIED';
  evidence.healthStatus = evidence.services.some(service => service.health === 'unhealthy' || service.state !== 'running')
    ? 'UNHEALTHY_OR_UNAVAILABLE' : evidence.services.every(service => service.health === 'healthy') ? 'HEALTHY' : 'UNVERIFIED';
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [flag, sha, outputFlag, output, ...extra] = process.argv.slice(2);
  if (flag !== '--expected-sha' || !SHA.test(sha ?? '') || outputFlag !== '--output' || !output || extra.length) {
    console.error('Usage: node scripts/release/inspect-runtime.mjs --expected-sha <40-character SHA> --output <file.json>');
    process.exitCode = 2;
  } else {
    try {
      const evidence = inspectRuntime(sha);
      writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      console.log(JSON.stringify({ revisionStatus: evidence.revisionStatus, healthStatus: evidence.healthStatus,
        blockers: evidence.blockers }));
      process.exitCode = evidence.blockers.length ? 1 : 0;
    } catch { console.error('Runtime observation could not be saved.'); process.exitCode = 2; }
  }
}
