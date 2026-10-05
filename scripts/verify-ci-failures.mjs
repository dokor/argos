import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Mutation probe: use the exact npm test command used by a job, require our
// deliberate failure marker, and remove only the fixture we just created.
const root = fileURLToPath(new URL('../', import.meta.url));
const configs = {
  frontend: ['apps/console-web', 'src/ci-negative-probe.test.ts',
    "import { test } from 'vitest'; test('negative CI probe', () => { throw new Error('CI_NEGATIVE_PROBE'); });"],
  lighthouse: ['apps/lighthouse-service', 'ci-negative-probe.test.mjs',
    "import test from 'node:test'; test('negative CI probe', () => { throw new Error('CI_NEGATIVE_PROBE'); });"],
  playwright: ['apps/playwright-service', 'ci-negative-probe.test.mjs',
    "import test from 'node:test'; test('negative CI probe', () => { throw new Error('CI_NEGATIVE_PROBE'); });"]
};
const targets = process.argv.slice(2);
if (!targets.length || targets.some(target => !configs[target])) {
  throw new Error('Specify frontend, lighthouse and/or playwright');
}
for (const target of targets) {
  const [app, fixture, content] = configs[target];
  const cwd = path.resolve(root, app), file = path.resolve(cwd, fixture);
  if (!file.startsWith(cwd + path.sep) || existsSync(file)) throw new Error('Probe file already exists or escapes app');
  writeFileSync(file, content + '\n', { flag: 'wx' });
  try {
    const result = process.platform === 'win32'
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run test'], { cwd, encoding: 'utf8', timeout: 120000 })
      : spawnSync('npm', ['run', 'test'], { cwd, encoding: 'utf8', timeout: 120000 });
    if (result.error || result.signal || result.status === 0 || result.status === null
        || !(result.stdout + result.stderr).includes('CI_NEGATIVE_PROBE')) {
      throw new Error(target + ': expected marked test failure was not observed');
    }
    console.log(JSON.stringify({ application: target, command: 'npm run test',
      exitCode: result.status, intentionalFailureDetected: true }));
  } finally { unlinkSync(file); }
}
