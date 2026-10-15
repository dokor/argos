import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const bash = process.platform === 'win32' ? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Git/bin/bash.exe') : 'bash';
for (const name of ['Build the standalone console-web Docker context']) {
  const step = workflow.split(`      - name: ${name}\n`)[1]?.split('\n      - ')[0];
  const block = step?.split('        run: |\n')[1];
  assert.ok(block, `Missing build step: ${name}`);
  // The build can be the last step: stop at the next YAML job as well as a step.
  const script = block.split(/\n(?= {0,9}\S)/)[0].split('\n').map(line => line.slice(10)).join('\n');
  for (const exitCode of [0, 37]) test(`${name}: build exit ${exitCode} survives log capture`, () => {
    const temp = mkdtempSync(join(tmpdir(), 'argos-build-pipeline-'));
    try {
      // Execute the actual workflow script, replacing only the expensive build commands.
      const stub = `npm() { printf 'Synthetic build result\\n'; return ${exitCode}; }\ndocker() { npm; }\n`;
      const result = spawnSync(bash, ['-e', '-c', stub + script], {
        encoding: 'utf8', timeout: 10000,
        env: { ...process.env, RUNNER_TEMP: temp.replaceAll('\\', '/') },
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, exitCode, result.stdout + result.stderr);
      assert.match(result.stdout, /Synthetic build result/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
}
