import { spawn } from 'node:child_process';
import { Launcher } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import puppeteer from 'puppeteer-core';
import { createLighthouseCollector, lighthouseChromeFlags } from './collector.mjs';
import { MAX_RESULT_BYTES } from './supervisor.mjs';
import { attachLinkNodes } from './evidence.mjs';

process.once('message', async ({ url, timeoutMs, navigationOrigins }) => {
  const collect = createLighthouseCollector({
    // The supervisor owns this worker's process group and scratch directory.
    // Do not let chrome-launcher detach Chrome into another process group.
    launch: async options => {
      const launcher = new Launcher(options, {
        spawn: (file, args, opts) => spawn(file, args, { ...opts, detached: false, windowsHide: true })
      });
      await launcher.launch();
      return { port: launcher.port, kill: () => process.exit(1) };
    },
    lighthouse: async (...args) => {
      const result = await lighthouse(...args);
      attachLinkNodes(result);
      const json = JSON.stringify(result?.lhr);
      if (!json || Buffer.byteLength(json, 'utf8') > MAX_RESULT_BYTES) process.exit(1);
      // Exit after IPC delivery; the supervisor kills Chrome and removes scratch
      // before publishing the result. No live CDP promise can crash its HTTP server.
      process.send({ type: 'result', json }, error => { if (error) process.exit(1); });
      return new Promise(() => {});
    },
    chromium, connectPuppeteer: options => puppeteer.connect(options),
    chromeFlags: lighthouseChromeFlags(Launcher.defaultFlags()), chromePath: process.env.CHROME_PATH,
    log: (event, fields) => process.send({ type: 'diagnostic', event, reason: fields.reason })
  });
  try { await collect(url, { timeoutMs, navigationOrigins }); }
  catch { process.exit(1); }
});
