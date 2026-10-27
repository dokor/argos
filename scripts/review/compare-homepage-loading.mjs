// Alternate production builds at the same port to expose drift on a shared workstation.
// Usage: node scripts/review/compare-homepage-loading.mjs BEFORE_APP AFTER_APP OUTPUT ROUNDS [simulate|devtools]
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const [before, after, destination, count = '5', method = 'simulate'] = process.argv.slice(2);
const rounds = Number(count);
if (!before || !after || !destination || !Number.isInteger(rounds) || rounds < 1 || rounds > 10
    || !['simulate', 'devtools'].includes(method)) throw new Error('Provide two built apps, output, 1..10 rounds, and simulate or devtools.');
const applications = { before: resolve(before), after: resolve(after) }, output = resolve(destination);
const target = 'http://localhost:3020/';
const prototype = process.env.ARGOS_LOCAL_PRECOMPRESSED === '1';
const serverPort = prototype ? '3021' : '3020';
const apiBase = process.env.API_BASE ?? 'http://127.0.0.1:3018';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(apiBase).hostname)) throw new Error('Use a loopback fixture API.');
const buildIds = Object.fromEntries(await Promise.all(Object.entries(applications).map(async ([key, app]) => [key, (await readFile(join(app, '.next/BUILD_ID'), 'utf8')).trim()])));
const requireAfter = createRequire(join(applications.after, 'package.json'));
const nextCli = requireAfter.resolve('next/dist/bin/next');
const measurement = fileURLToPath(new URL('./measure-homepage-lcp.mjs', import.meta.url));
const samples = [];
await mkdir(output, { recursive: true });
try { await fetch(target, { signal: AbortSignal.timeout(1000) }); throw new Error('Port 3020 is occupied. Stop its owner before measuring.'); }
catch (error) { if (error.message.startsWith('Port 3020')) throw error; }
if (prototype) {
  try { await fetch('http://127.0.0.1:3021/', { signal: AbortSignal.timeout(1000) }); throw new Error('Port 3021 is occupied.'); }
  catch (error) { if (error.message.startsWith('Port 3021')) throw error; }
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, 'close');
  child.kill('SIGTERM');
  await closed;
}

for (let round = 1; round <= rounds; round++) {
  for (const version of round % 2 ? ['before', 'after'] : ['after', 'before']) {
    const label = `${round}-${version}`, folder = join(output, label);
    await mkdir(folder, { recursive: true });
    const serverLog = createWriteStream(join(folder, 'server.log'));
    const server = spawn(process.execPath, [nextCli, 'start', applications[version], '--port', serverPort, '--hostname', '127.0.0.1'], {
      cwd: applications[version],
      env: { ...process.env, API_BASE: apiBase, ACCOUNT_ORIGIN: target.slice(0, -1), NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
    const proxyLog = prototype ? createWriteStream(join(folder, 'local-proxy.log')) : null;
    const proxy = prototype ? spawn(process.execPath, [fileURLToPath(new URL('./local-precompressed-proxy.mjs', import.meta.url)), applications[version], version], {
      env: process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    }) : null;
    if (proxy) { proxy.stdout.pipe(proxyLog); proxy.stderr.pipe(proxyLog); }
    try {
      let ready = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        if (server.exitCode !== null) throw new Error(`Server ${label} exited before readiness.`);
        if (proxy && proxy.exitCode !== null) throw new Error(`Local proxy ${label} exited before readiness. See local-proxy.log.`);
        let response;
        try { response = await fetch(target, { signal: AbortSignal.timeout(2000) }); } catch {}
        if (response?.status >= 500) throw new Error(`Server ${label} returned ${response.status}. See server.log.`);
        ready = response?.ok === true;
        if (ready) break;
        await delay(250);
      }
      if (!ready) throw new Error(`Server ${label} did not become ready.`);
      const warmup = await fetch(target);
      if (!warmup.ok) throw new Error(`Server warm-up failed for ${label}.`);
      await writeFile(join(folder, 'warmup.html'), await warmup.text());
      await writeFile(join(folder, 'headers.json'), JSON.stringify(Object.fromEntries(warmup.headers), null, 2) + '\n');
      const measurementLog = createWriteStream(join(folder, 'measurement.log'));
      const child = spawn(process.execPath, [measurement, target, folder, '1', method === 'devtools' ? '1' : '0', method], {
        env: process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      });
      child.stdout.pipe(measurementLog); child.stderr.pipe(measurementLog);
      const [code] = await once(child, 'close');
      measurementLog.end();
      if (code !== 0) throw new Error(`Measurement ${label} failed: ${code}.`);
      if ((await readFile(join(applications[version], '.next/BUILD_ID'), 'utf8')).trim() !== buildIds[version]) {
        throw new Error(`Build ${version} changed during measurement. Rebuild first, then start a new series.`);
      }
      const result = JSON.parse(await readFile(join(folder, 'summary.json'), 'utf8'));
      samples.push({ ...result, variant: version, round });
      await writeFile(join(output, 'series.json'), JSON.stringify({ target, method, rounds, buildIds, delivery: prototype ? 'local-static-precompression-prototype' : 'next-start', samples }, null, 2) + '\n');
      console.log(JSON.stringify({ version, round, medians: result.medians }));
    } finally {
      if (proxy) await stop(proxy);
      proxyLog?.end();
      await stop(server);
      serverLog.end();
    }
  }
}
