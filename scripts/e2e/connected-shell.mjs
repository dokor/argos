import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';

const base = process.env.CONNECTED_BASE_URL ?? 'http://127.0.0.1:3020';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local fixture only');
const output = process.env.CONNECTED_OUTPUT ?? 'outputs/ui-review/clarte-shell';
await mkdir(output, { recursive: true });
const fixture = JSON.parse(await readFile('docs/connected-space/fixtures/connected-space.json', 'utf8'));
const copies = Object.fromEntries(await Promise.all(['fr', 'en'].map(async lang => [lang,
  JSON.parse(await readFile(`apps/console-web/src/lib/i18n/${lang}.json`, 'utf8'))])));
const browser = await chromium.launch(process.env.CLARTE_BROWSER_PATH ? { executablePath: process.env.CLARTE_BROWSER_PATH } : {});
const results = [];
try {
  for (const width of [320, 390, 768, 1056, 1440]) for (const lang of ['fr', 'en']) for (const theme of ['light', 'dark']) {
    const c = copies[lang].connected;
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let mode = 'admin';
    await page.route('**/api/account/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/me') && mode === 'loading') return; // Held until context disposal; no invented identity.
      let status = 200, data = {};
      if (path.endsWith('/me')) {
        status = mode === 'expired' ? 401 : mode === 'error' ? 503 : 200;
        data = status !== 200 ? { error: status === 401 ? 'session_invalid' : 'account_unavailable' }
          : { displayName: 'Camille · Atelier de démonstration', email: 'fixture@example.com', verified: mode !== 'pending', admin: mode === 'admin' };
      } else if (path.endsWith('/usage')) {
        status = mode === 'quota-error' ? 503 : 200;
        data = status === 503 ? { error: 'account_unavailable' } : { offer: 'FREE', period: '2026-10', timezone: 'UTC', startsAt: '2026-10-01T00:00:00Z', resetsAt: '2027-01-01T00:00:00Z', used: fixture.usage.used, reserved: fixture.usage.reserved, limit: mode === 'unlimited' ? null : mode === 'zero' ? fixture.usage.used + fixture.usage.reserved : fixture.usage.limit, canLaunch: mode !== 'zero' };
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const url = base + (lang === 'en' ? '/en' : '') + '/account/integrations';
    async function check(name) {
      const frame = page.locator('[data-connected-shell]');
      await frame.waitFor(); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('h1').count(), 1, 'One page title');
      assert.equal(await page.getByRole('contentinfo').count(), 1, 'One footer in every state');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${name}: no global horizontal scroll`);
      await page.addScriptTag({ path: 'apps/console-web/node_modules/axe-core/axe.min.js' });
      const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('[data-connected-shell]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
      assert.deepEqual(violations, [], name);
      const file = `${name}-${lang}-${theme}-${width}.png`;
      await page.screenshot({ path: `${output}/${file}`, fullPage: true });
      results.push({ name, lang, theme, width, screenshot: file, overflow: false, axeViolations: 0 });
    }
    await page.goto(url);
    await page.getByRole('heading', { name: c.api.title, exact: true }).waitFor();
    await page.getByRole('link', { name: `${fixture.usage.expectedAvailable} ${c.credits}` }).waitFor();
    assert.equal(await page.getByRole('link', { name: c.account, exact: true }).count(), 1, 'Account reachable at every width');
    assert.equal(await page.locator('main button').count(), 0, 'No fake integration activation');
    const example = page.locator('main details').first();
    await example.locator('summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await example.evaluate(el => el.open), true, 'Example opens with keyboard');
    await page.keyboard.press('Enter');
    assert.equal(await example.evaluate(el => el.open), false);
    if (width <= 900) {
      const menu = page.getByRole('button', { name: c.menu, exact: true });
      await menu.focus(); await page.keyboard.press('Enter');
      await page.getByRole('link', { name: c.admin, exact: true }).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.equal(await menu.evaluate(el => el === document.activeElement), true, 'Escape restores focus');
    }
    await check('integrations');
    // Session and quota states at both ends of the responsive matrix, in FR/EN and both themes.
    if ([320, 1440].includes(width)) for (const nextMode of ['user', 'pending', 'quota-error', 'zero', 'unlimited', 'expired', 'error', 'loading']) {
      mode = nextMode; await page.reload();
      if (mode === 'expired') await page.getByRole('heading', { name: c.sessionTitle }).waitFor();
      else if (mode === 'error') await page.getByRole('heading', { name: c.errorTitle }).waitFor();
      else if (mode === 'loading') await page.getByRole('heading', { name: c.loading }).waitFor();
      else {
        await page.getByRole('heading', { name: c.api.title }).waitFor();
        if (mode === 'quota-error') await page.getByText(c.quotaUnavailable, { exact: true }).waitFor();
        if (mode === 'zero') await page.getByRole('link', { name: `0 ${c.credits}` }).waitFor();
        if (mode === 'unlimited') await page.getByRole('link', { name: c.unlimitedCredits }).waitFor();
      }
      assert.equal(await page.locator('nav a[href$="/account/admin"]').count(), 0, 'No admin link outside active verified admin');
      await check(mode);
    }
    // Demonstration data must never be available in the production build.
    if (width === 1440 && theme === 'light') {
      await page.goto(base + (lang === 'en' ? '/en' : '') + '/account/design-preview');
      assert.equal(await page.getByText(c.preview, { exact: true }).count(), 0, 'No development fixture in production');
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ browser: browser.version(), viewportHeight: 900, fixture: 'canonical Clarté usage + mocked same-origin identity; no live user data or authorization proof', checks: results }, null, 2));
  console.log(`${results.length} connected shell visual/accessibility scenarios passed`);
} finally { await browser.close(); }
