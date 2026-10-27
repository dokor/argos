import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const imagePattern = /^sha256:[a-f0-9]{64}$/;
const expectedConfig = '/srv/configs/api-backend/prod.conf';
const invoke = (command, args, options = {}) => execFileSync(command, args, {
  encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 1024 * 1024, ...options,
});
const docker = (args, options) => invoke('docker', args, options);
const one = args => JSON.parse(docker(args))[0];

export function safeSettings(value) {
  const result = {};
  for (const key of ['sessionSeconds', 'idleSeconds', 'jwtSeconds', 'recentSeconds']) {
    if (!Number.isSafeInteger(value?.[key]) || value[key] <= 0) throw new Error('settings-invalid');
    result[key] = value[key];
  }
  return result;
}
export function settingsAre24h(value) {
  return value.sessionSeconds === 86400 && value.idleSeconds === 86400;
}

export function assertOperationContext(env, args) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main'
    || env.GITHUB_REPOSITORY !== 'dokor/argos' || !/^[a-f0-9]{40}$/.test(env.EXPECTED_REVISION ?? '')
    || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '') || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? '')
    || !env.ARGOS_CI_EMAIL || !env.ARGOS_CI_PASSWORD || args.some(arg => arg !== '--apply-24h')) throw new Error('operation-not-authorized');
}

async function main() {
  const evidence = { status: 'FAILED', configurationChanged: false };
  let phase = 'guard', temporary, backendImage, browserImage, backupName, browserName, probeCopied = false;
  const recreate = () => docker(['compose', '-f', '/srv/apps/api-backend/docker-compose.prod.yml',
    'up', '-d', '--no-build', '--force-recreate', '--no-deps', 'api-backend'], { timeout: 120000 });
  const configure = operation => JSON.parse(docker(['run', '--rm', '-i', '--network', 'none', '--read-only',
    '--user', '0:0', '--mount', 'type=bind,src=/srv/configs/api-backend,dst=/ops',
    '--entrypoint', 'node', browserImage, '--input-type=module', '-', operation, backupName], {
    input: readFileSync(resolve(root, 'scripts/ops/session-config.mjs')),
  }));
  const probe = () => {
    docker(['cp', resolve(temporary, 'ArgosSessionSettingsProbe.class'), 'api-backend:/tmp/ArgosSessionSettingsProbe.class']);
    probeCopied = true;
    return safeSettings(JSON.parse(docker(['exec', 'api-backend', 'java', '-Xms16m', '-Xmx64m',
      '-cp', '/tmp:/app/app.jar:/app/lib/*', 'ArgosSessionSettingsProbe'])));
  };
  try {
    const revision = process.env.EXPECTED_REVISION;
    assertOperationContext(process.env, process.argv.slice(2));
    phase = 'runtime-revision';
    const containers = {};
    for (const name of ['api-backend', 'console-web', 'playwright-service']) {
      const container = one(['container', 'inspect', name]);
      if (!container.State?.Running || container.State.OOMKilled || !imagePattern.test(container.Image)) throw new Error('runtime');
      const image = one(['image', 'inspect', container.Image]);
      if (name !== 'playwright-service' && image.Config?.Labels?.['org.opencontainers.image.revision'] !== revision) throw new Error('revision');
      containers[name] = container;
    }
    const mount = containers['api-backend'].Mounts?.find(m => m.Destination === '/config/prod.conf');
    if (mount?.Source !== expectedConfig || mount.Type !== 'bind') throw new Error('config-mount');
    backendImage = containers['api-backend'].Image;
    browserImage = containers['playwright-service'].Image;
    if (one(['image', 'inspect', 'api-backend:local']).Id !== backendImage) throw new Error('image-tag-changed');
    evidence.applicationRevision = revision;
    temporary = mkdtempSync(resolve(tmpdir(), 'argos-session-check-'));
    phase = 'compile-settings-probe';
    invoke('javac', ['--release', '21', '-d', temporary, resolve(root, 'scripts/ops/ArgosSessionSettingsProbe.java')]);
    phase = 'read-effective-settings';
    evidence.before = probe();
    if (!settingsAre24h(evidence.before)) {
      if (!process.argv.includes('--apply-24h')) throw new Error('configuration-mismatch');
      phase = 'configure-24h';
      backupName = `prod.conf.sessions-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-${randomBytes(8).toString('hex')}.bak`;
      const applied = configure('apply');
      if (typeof applied.changed !== 'boolean') throw new Error('configuration-failed');
      evidence.configurationChanged = applied.changed;
      if (applied.changed) {
        evidence.privateBackupCreated = true;
        phase = 'recreate-backend';
        try {
          recreate();
          evidence.after = probe();
          if (!settingsAre24h(evidence.after)) throw new Error('configuration-mismatch');
        } catch {
          phase = 'configuration-rollback';
          configure('restore'); recreate();
          evidence.configurationRolledBack = true;
          throw new Error('rollback');
        }
      }
    }
    evidence.after ??= probe();
    if (!settingsAre24h(evidence.after)) throw new Error('configuration-mismatch');
    phase = 'public-readiness';
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch('https://argos.lelouet.fr/api/account/auth/providers', { redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('unavailable');
        await response.body?.cancel(); break;
      } catch {
        if (attempt >= 12) throw new Error('unavailable');
        await new Promise(done => setTimeout(done, 5000));
      }
    }
    phase = 'browser-renewal';
    browserName = `argos-session-probe-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
    const browserArgs = ['run', '--rm', '-i', '--name', browserName,
      '--label', `argos.session-probe=${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`,
      '--network', 'proxy', '--read-only', '--tmpfs', '/tmp:rw,size=256m', '--shm-size', '256m',
      '--memory', '768m', '--cpus', '1', '--pids-limit', '256', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges:true', '-e', 'ARGOS_CI_EMAIL', '-e', 'ARGOS_CI_PASSWORD',
      '--entrypoint', 'node', browserImage, '--input-type=module', '-'];
    try { evidence.browser = JSON.parse(docker(browserArgs, {
      input: readFileSync(resolve(root, 'scripts/ops/session-browser.mjs')), timeout: 13 * 60000,
    })); } catch (error) {
      try {
        const result = JSON.parse(String(error.stdout));
        if (result.status === 'FAILED' && /^[a-z-]+$/.test(result.failedPhase)) evidence.browser = { status: 'FAILED', failedPhase: result.failedPhase };
      } catch {}
      throw new Error('browser-failed');
    }
    if (evidence.browser.status !== 'PASSED') throw new Error('browser-failed');
    phase = 'final-runtime';
    for (const name of ['api-backend', 'console-web']) {
      const container = one(['container', 'inspect', name]);
      if (!container.State?.Running || container.Image !== containers[name].Image || container.State.OOMKilled) throw new Error('runtime-changed');
    }
    evidence.status = 'PASSED';
  } catch {
    evidence.failedPhase = phase;
    process.exitCode = 1;
  } finally {
    if (browserName) {
      try {
        const stale = one(['container', 'inspect', browserName]);
        if (stale.Config?.Labels?.['argos.session-probe'] === `${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`)
          docker(['container', 'rm', '-f', browserName]);
      } catch {}
    }
    if (probeCopied) try { docker(['exec', 'api-backend', 'rm', '-f', '/tmp/ArgosSessionSettingsProbe.class']); } catch {}
    if (temporary && dirname(temporary) === resolve(tmpdir()) && basename(temporary).startsWith('argos-session-check-')) rmSync(temporary, { recursive: true, force: true });
    mkdirSync(resolve(root, 'outputs'), { recursive: true });
    writeFileSync(resolve(root, 'outputs/production-sessions.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(evidence));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
