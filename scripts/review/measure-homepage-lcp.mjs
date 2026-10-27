// Local production-build comparison. Requires apps/lighthouse-service dependencies.
// Usage: node scripts/review/measure-homepage-lcp.mjs URL OUTPUT_DIR [cold runs] [warm runs] [devtools|simulate]
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const target = new URL(process.argv[2] ?? 'http://localhost:3020/');
if (!['http:', 'https:'].includes(target.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || target.username || target.password) throw new Error('Use a local fixture URL without credentials.');
const output = resolve(process.argv[3] ?? 'outputs/lcp-measurement');
const coldRuns = Number(process.argv[4] ?? 3), warmRuns = Number(process.argv[5] ?? 2);
if (!Number.isInteger(coldRuns) || coldRuns < 1 || coldRuns > 10
    || !Number.isInteger(warmRuns) || warmRuns < 0 || warmRuns > 10) throw new Error('Cold runs must be 1..10, warm runs 0..10.');
const throttlingMethod = process.argv[6] ?? 'devtools';
if (!['devtools', 'simulate'].includes(throttlingMethod)) throw new Error('Use devtools or simulate throttling.');
const toolRoot = process.env.ARGOS_LIGHTHOUSE_ROOT
  ?? fileURLToPath(new URL('../../apps/lighthouse-service/node_modules/lighthouse/', import.meta.url));
const requireTool = createRequire(join(toolRoot, 'package.json'));
const { default: lighthouse } = await import(pathToFileURL(join(toolRoot, 'core/index.js')));
const { launch } = await import(pathToFileURL(requireTool.resolve('chrome-launcher')));
const chrome = await launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ['--headless', '--disable-gpu'] });
const samples = [];
const median = values => {
  const sorted = values.toSorted((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
let profile, version, browser;
try {
  await mkdir(output, { recursive: true });
  for (const [cache, count] of [['cold', coldRuns], ['warm', warmRuns]]) {
    for (let run = 1; run <= count; run++) {
      const result = await lighthouse(target.href, {
        port: chrome.port, onlyCategories: ['performance'], output: 'json', logLevel: 'error',
        throttlingMethod, disableStorageReset: cache === 'warm',
      });
      const report = result?.lhr;
      if (!report || report.runtimeError) throw new Error(report?.runtimeError?.message ?? 'No Lighthouse report.');
      const settings = report.configSettings;
      const currentProfile = { formFactor: settings.formFactor, screenEmulation: settings.screenEmulation,
        throttling: settings.throttling, throttlingMethod: settings.throttlingMethod, emulatedUserAgent: settings.emulatedUserAgent };
      if (profile && JSON.stringify(profile) !== JSON.stringify(currentProfile)) throw new Error('Measurement profile changed.');
      if (version && version !== report.lighthouseVersion) throw new Error('Lighthouse version changed.');
      if (browser && browser !== report.environment.hostUserAgent) throw new Error('Browser version changed.');
      profile = currentProfile; version = report.lighthouseVersion; browser = report.environment.hostUserAgent;
      const requests = report.audits['network-requests'].details.items;
      const sample = { cache, run, lcp: report.audits['largest-contentful-paint'].numericValue,
        fcp: report.audits['first-contentful-paint'].numericValue, tbt: report.audits['total-blocking-time'].numericValue,
        cls: report.audits['cumulative-layout-shift'].numericValue, score: report.categories.performance.score,
        benchmarkIndex: report.environment.benchmarkIndex,
        cssRequests: requests.filter(r => r.resourceType === 'Stylesheet').length,
        cssTransfer: requests.filter(r => r.resourceType === 'Stylesheet').reduce((sum, r) => sum + r.transferSize, 0),
        scriptRequests: requests.filter(r => r.resourceType === 'Script').length,
        scriptTransfer: requests.filter(r => r.resourceType === 'Script').reduce((sum, r) => sum + r.transferSize, 0),
        fontTransfer: requests.filter(r => r.resourceType === 'Font').reduce((sum, r) => sum + r.transferSize, 0),
        documentTransfer: requests.filter(r => r.resourceType === 'Document').reduce((sum, r) => sum + r.transferSize, 0),
        failedRequests: requests.filter(r => r.statusCode >= 400).length,
        totalTransfer: requests.reduce((sum, r) => sum + r.transferSize, 0) };
      for (const metric of ['lcp', 'fcp', 'tbt', 'cls', 'score', 'cssTransfer', 'scriptTransfer', 'totalTransfer']) {
        if (!Number.isFinite(sample[metric]) || sample[metric] < 0) throw new Error(`Missing or invalid ${metric}.`);
      }
      await writeFile(join(output, `${cache}-${run}.json`), JSON.stringify(report, null, 2));
      samples.push(sample); console.log(JSON.stringify(sample));
    }
  }
  const summary = { url: target.href, version, browser, profile, samples,
    medians: Object.fromEntries(['cold', 'warm'].filter(cache => samples.some(s => s.cache === cache)).map(cache => [cache, Object.fromEntries(
      ['lcp', 'fcp', 'tbt', 'cls', 'score', 'totalTransfer'].map(key => [key, median(samples.filter(s => s.cache === cache).map(s => s[key]))]))])) };
  await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
} finally {
  await chrome.kill();
}
