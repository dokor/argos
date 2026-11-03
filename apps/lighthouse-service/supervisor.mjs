import { fork, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { analysisUrl } from './policy.mjs';
import { navigationScope } from './browser-policy.mjs';

export const MAX_RESULT_BYTES = 8 * 1024 * 1024;

function killGroup(child) {
  if (!Number.isInteger(child.pid) || child.pid < 1) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'],
      { windowsHide: true, stdio: 'ignore', timeout: 5000 });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}

// Lighthouse's pending CDP promises can reject outside its returned promise when
// Chrome closes. Keep that failure outside the HTTP server and own the whole
// process group, including Chrome before it finishes launching.
export function createSupervisedCollector({ workerFile = new URL('./worker.mjs', import.meta.url),
  temporaryRoot = tmpdir(), maxResultBytes = MAX_RESULT_BYTES, log = () => {} } = {}) {
  if (!Number.isSafeInteger(maxResultBytes) || maxResultBytes < 1 || maxResultBytes > MAX_RESULT_BYTES)
    throw new TypeError('Invalid result limit');
  return async (url, { signal, timeoutMs = 60000, navigationOrigins } = {}) => {
    analysisUrl(url);
    navigationOrigins = navigationScope(navigationOrigins,url);
    const budget = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(60000, timeoutMs) : 60000;
    const deadline = AbortSignal.any([AbortSignal.timeout(Math.ceil(budget)), ...(signal ? [signal] : [])]);
    deadline.throwIfAborted();
    const root = resolve(temporaryRoot);
    const scratch = await mkdtemp(join(root, 'argos-lighthouse-'));
    // Only remove the fresh directory created above, never a path from a result.
    if (dirname(resolve(scratch)) !== root) throw new Error('Invalid temporary directory');
    let child;
    try {
      deadline.throwIfAborted();
      const env = {};
      for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'LANG', 'LC_ALL', 'TZ',
        'CHROME_PATH', 'PLAYWRIGHT_BROWSERS_PATH', 'AUDIT_EGRESS_PROXY'])
        if (process.env[key]) env[key] = process.env[key];
      Object.assign(env, { NODE_ENV: 'production', HOME: scratch, TMPDIR: scratch, TMP: scratch, TEMP: scratch });
      return await new Promise((resolveResult, reject) => {
        let result, failure, stoppedForResult = false, diagnostics = 0;
        child = fork(workerFile, [], { env, execArgv: [], serialization: 'json',
          detached: process.platform !== 'win32', windowsHide: true,
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        const stop = () => {
          try { killGroup(child); }
          catch { failure = new Error('Collector cleanup failed'); child.kill('SIGKILL'); }
        };
        const fail = () => { failure = new Error('Collector unavailable'); stop(); };
        deadline.addEventListener('abort', stop, { once: true });
        child.on('error', () => { failure = new Error('Collector unavailable'); });
        child.on('message', message => {
          if (message?.type === 'diagnostic') {
            if (++diagnostics <= 20 && message.event === 'analyze.navigation_failed')
              log(message.event, { reason: typeof message.reason === 'string' && /^net::ERR_[A-Z_0-9]{1,60}$/.test(message.reason) ? message.reason : 'NETWORK_ERROR' });
            return;
          }
          if (message?.type !== 'result' || result || typeof message.json !== 'string'
            || Buffer.byteLength(message.json, 'utf8') > maxResultBytes) { fail(); return; }
          try { result = { lhr: JSON.parse(message.json) }; stoppedForResult = true; stop(); }
          catch { fail(); }
        });
        child.once('close', code => {
          deadline.removeEventListener('abort', stop);
          // Chrome inherits this group even if the worker crashed or exited first.
          try { stop(); } catch { failure = new Error('Collector cleanup failed'); }
          if (deadline.aborted || failure || (code !== 0 && !stoppedForResult) || !result)
            reject(new Error(deadline.aborted ? 'Analysis timeout' : 'Collector unavailable'));
          else resolveResult(result);
        });
        if (deadline.aborted) stop();
        else child.send({ url, timeoutMs: budget, ...(navigationOrigins ? { navigationOrigins } : {}) }, error => { if (error) fail(); });
      });
    } finally {
      if (child) killGroup(child);
      await rm(scratch, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
    }
  };
}
