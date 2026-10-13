// Captures the design reference only. Does not test the Argos application.
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const repo = path.resolve(__dirname, '../../..');
const resolveProject = createRequire(path.join(repo, 'apps/playwright-service/package.json'));
const { chromium } = process.env.CLARTE_PLAYWRIGHT_MODULE
  ? require(process.env.CLARTE_PLAYWRIGHT_MODULE) : resolveProject('playwright');
const output = path.resolve(process.argv[2] || path.join(repo, 'outputs/clarte-reference'));
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CLARTE_BROWSER_PATH ? { executablePath: process.env.CLARTE_BROWSER_PATH } : {}) });
  const checks = [], errors = [];
  try {
    for (const width of [1056, 390, 320, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 1200 }, colorScheme: 'light' });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(__dirname, 'clarte.html')).href);
      const app = page.locator('#argos-clarte-modules');
      await app.locator('h1').waitFor();
      await app.locator('svg').first().waitFor();
      async function capture(name, screenshot = true) {
        const result = await app.evaluate(el => ({ width: el.clientWidth,
          scroll: el.scrollWidth, h1: el.querySelectorAll('h1').length,
          footer: !!el.querySelector('.a-footer') }));
        if (result.scroll > result.width + 2 || result.h1 !== 1 || !result.footer)
          throw new Error(JSON.stringify({ name, width, ...result }));
        const file = `${name}-${width}.png`;
        if (screenshot && (width === 1056 || width === 390)) {
          await page.setViewportSize({ width, height: await app.evaluate(el => el.offsetHeight + 32) });
          await page.screenshot({ path: path.join(output, file), fullPage: true });
        }
        checks.push({ name, viewport: width, ...result,
          screenshot: screenshot && [1056,390].includes(width) ? file : null });
      }
      await capture('domain-list');
      await app.locator('[data-d-open="0"]').click();
      await capture('domain-summary');
      if (await app.locator('.d-common').count() !== 3) throw new Error('Expected 3 common findings');
      await app.locator('[data-d-rule="csp"]').click();
      if (await app.locator('.d-table tbody tr').count() !== 6) throw new Error('Expected 6 CSP pages');
      await capture('affected-pages');
      await app.locator('[data-d-page="1"]').click();
      await capture('page-report');
      await app.locator('[data-go="domain"]').first().click();
      await app.locator('[data-d-action="new"]').first().click();
      await capture('domain-new');
      await app.locator('#domain-host').fill('atelier-nova.fr');
      await app.locator('[data-form="domain-discover"] button').click();
      await capture('domain-selection');
      for (const name of ['dashboard','analysis','quota','admin','integrations']) {
        await app.locator(`[data-go="${name}"]`).first().click();
        await capture(name);
      }
      await app.locator('[data-go="admin"]').first().click();
      await app.locator('[data-admin-user="1"]').click();
      await capture('admin-detail');
      await app.locator('[data-go="account"]:visible').first().click();
      await capture('account');
      if (width === 1056) {
        await app.locator('[data-go="domain"]').first().click();
        await app.locator('[data-d-open="0"]').click();
        await page.emulateMedia({ colorScheme: 'dark' });
        await capture('dark-domain-summary');
      }
      await page.close();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(path.join(output, 'capture-report.json'), JSON.stringify({
      purpose:'Design reference, not application E2E', browser:browser.version(), checks, errors
    }, null, 2) + '\n');
    console.log(JSON.stringify({ checks:checks.length, errors, output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
