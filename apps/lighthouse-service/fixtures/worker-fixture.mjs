import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

process.once('message', ({ url }) => {
  writeFileSync(join(tmpdir(), 'fixture.txt'), 'synthetic private scratch');
  const mode = new URL(url).pathname;
  if (mode === '/crash') { void Promise.reject(new Error('fixture-secret-do-not-log')); return; }
  if (mode === '/hang') { setInterval(() => {}, 1000); return; }
  let lhr = { categories: { accessibility: { score: 1 } }, hasSecret: Boolean(process.env.ARGOS_TEST_SECRET) };
  if (mode === '/large') lhr = { untrusted: 'x'.repeat(8192) };
  if (mode === '/descendant') {
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'],
      { detached: false, windowsHide: true, stdio: 'ignore' });
    lhr = { childPid: child.pid };
  }
  process.send({ type: 'result', json: JSON.stringify(lhr) });
  // Deliberately remain alive. The supervisor must stop this process and any child.
  setInterval(() => {}, 1000);
});
