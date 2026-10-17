import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import { response } from './connected-domains-fixture.mjs';

const base = process.env.CONNECTED_BASE_URL ?? 'http://127.0.0.1:3020';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local fixtures only');
const output = 'outputs/ui-review/navigation-submenus';
await mkdir(output, { recursive: true });
const copies = Object.fromEntries(await Promise.all(['fr', 'en'].map(async lang => [lang,
  JSON.parse(await readFile(`apps/console-web/src/lib/i18n/${lang}.json`, 'utf8'))])));
const browser = await chromium.launch(process.env.CLARTE_BROWSER_PATH ? { executablePath: process.env.CLARTE_BROWSER_PATH } : {});
const results = [];
let lastPage;

try {
  for (const width of [320, 390, 768, 1440]) for (const lang of ['fr', 'en']) for (const theme of ['light', 'dark']) {
    const c = copies[lang].connected, g = c.navGroups, prefix = lang === 'en' ? '/en' : '';
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
    const page = await context.newPage(), errors = [];
    lastPage = page;
    page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', error => errors.push(error.message));
    const admin = theme === 'dark';
    await page.route('**/api/account/**', async route => {
      const url = new URL(route.request().url());
      let data = response(url.pathname, url.searchParams);
      if (url.pathname === '/api/account/me') data = { ...data, admin };
      if (url.pathname === '/api/account/notifications') data = { items: [], unread: 0, cursor: null, serverTime: '2026-10-17T08:00:00Z' };
      if (url.pathname === '/api/account/overview') data = { recentRuns: [] };
      await route.fulfill({ status: data ? 200 : 404, contentType: 'application/json', body: JSON.stringify(data ?? { error: 'resource_unavailable' }) });
    });
    const nav = page.getByRole('navigation', { name: c.navigation, exact: true });
    const link = label => nav.getByRole('link', { name: label, exact: true });
    const button = label => nav.getByRole('button', { name: label, exact: true });
    async function openMenu() {
      if (width <= 900) {
        const menu = page.getByRole('button', { name: c.menu, exact: true });
        if (await menu.count()) await menu.click();
      }
    }
    async function capture(name) {
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), name + ': no page overflow');
      const boxes = await nav.locator('a:visible, button:visible').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { label: node.getAttribute('aria-label'), width: rect.width, height: rect.height };
      }));
      assert.ok(boxes.every(box => box.width >= 44 && box.height >= 44), JSON.stringify(boxes));
      await page.addScriptTag({ path: 'apps/console-web/node_modules/axe-core/axe.min.js' });
      const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('[data-connected-shell]'), {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
      assert.deepEqual(violations, [], name);
      const file = `${name}-${lang}-${theme}-${width}.png`;
      await page.screenshot({ path: `${output}/${file}`, fullPage: true });
      results.push({ name, lang, theme, width, admin, screenshot: file, axeViolations: 0, overflow: false });
    }

    await page.goto(base + prefix + '/account/analyses/new');
    await page.locator('#analysis-url').waitFor();
    await openMenu();
    assert.equal(await button(g.collapseAnalyses).getAttribute('aria-expanded'), 'true', 'Direct arrival opens active section');
    assert.equal(await link(g.newAnalysis).getAttribute('aria-current'), 'page');
    assert.equal(await link(g.analyses).getAttribute('aria-current'), null, 'Group differs from current page');
    assert.equal(await nav.getByRole('link', { name: c.admin, exact: true }).count(), admin ? 1 : 0);
    assert.equal(await link(`${c.integrations} — ${c.soon}`).getAttribute('href'), prefix + '/account/integrations');

    const url = page.url();
    await button(g.expandDomains).focus();
    await page.keyboard.press('Enter');
    assert.equal(page.url(), url, 'Chevron never navigates');
    assert.equal(await button(g.collapseDomains).getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Space');
    assert.equal(await button(g.expandDomains).getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal(await link(g.myDomains).evaluate(node => node === document.activeElement), true, 'Tab reaches first child');
    assert.equal(await link(g.myDomains).getAttribute('href'), prefix + '/account/domains');
    assert.equal(await link(g.newDomain).getAttribute('href'), prefix + '/account/domains/new');
    assert.equal(await link(g.history).getAttribute('href'), prefix + '/account/sites');
    await capture('expanded');

    if (width > 900) {
      await page.getByRole('button', { name: c.collapseMenu, exact: true }).click();
      for (const label of [g.newAnalysis, g.history, g.myDomains, g.newDomain]) {
        await link(label).focus();
        assert.equal(await link(label).evaluate(node => node === document.activeElement), true);
        const box = await link(label).boundingBox(), sidebar = await page.locator('aside').first().boundingBox();
        assert.ok(box.x >= sidebar.x && box.x + box.width <= sidebar.x + sidebar.width + 1, 'Compact destinations fit the rail');
      }
      await capture('compact');
      await link(c.help).focus();
      const helpBox = await link(c.help).boundingBox();
      assert.ok(helpBox.y >= 0 && helpBox.y + helpBox.height <= 900, 'Keyboard scroll reveals the last rail destination');
      assert.equal(await page.getByRole('button', { name: new RegExp('^' + c.accountMenu) }).count(), 1, 'Compact account menu remains available');
      await page.getByRole('button', { name: c.expandMenu, exact: true }).click();
    }

    await button(g.collapseAnalyses).click();
    assert.equal(await link(g.newAnalysis).count(), 0, 'Manual collapse is respected');
    assert.equal(await link(g.analyses).getAttribute('aria-current'), 'location', 'Closed active section remains identifiable');
    await link(g.newDomain).click();
    await page.waitForURL(base + prefix + '/account/domains/new');
    await openMenu();
    assert.equal(await button(g.expandAnalyses).getAttribute('aria-expanded'), 'false', 'Other group retains manual state');
    assert.equal(await link(g.newDomain).getAttribute('aria-current'), 'page');
    await button(g.expandAnalyses).click();
    await link(g.history).click();
    await page.waitForURL(base + prefix + '/account/sites');
    if (width <= 900) assert.equal(await page.getByRole('button', { name: c.menu, exact: true }).getAttribute('aria-expanded'), 'false', 'Child navigation closes mobile menu');
    await openMenu();
    assert.equal(await link(g.history).getAttribute('aria-current'), 'page');
    assert.equal(await button(g.collapseDomains).getAttribute('aria-expanded'), 'true', 'Open sibling survives route change');
    await link(c.domains).click();
    await page.waitForURL(base + prefix + '/account/domains');
    await openMenu();
    assert.equal(await link(g.myDomains).getAttribute('aria-current'), 'page', 'Parent navigates to section home');
    await page.getByRole('heading', { name: copies[lang].domainPage.listTitle, level: 1, exact: true }).waitFor();
    await capture('domain-list');
    await page.reload();
    await openMenu();
    assert.equal(await button(g.collapseDomains).getAttribute('aria-expanded'), 'true', 'Refresh reveals active child');
    if (width <= 900) {
      await button(g.collapseDomains).focus();
      await page.keyboard.press('Escape');
      const menu = page.getByRole('button', { name: c.menu, exact: true });
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.equal(await menu.evaluate(node => node === document.activeElement), true);
    }
    assert.deepEqual(errors, [], 'No browser errors');
    await context.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ browser: browser.version(), fixture: 'Read-only fictional data; permissions asserted through mocked identity', checks: results }, null, 2));
  console.log(`${results.length} navigation submenu visual/accessibility scenarios passed`);
} catch (error) {
  if (lastPage && !lastPage.isClosed()) {
    await lastPage.screenshot({ path: `${output}/failure.png`, fullPage: true });
    await writeFile(`${output}/failure.txt`, await lastPage.locator('body').innerText());
  }
  throw error;
} finally {
  await browser.close();
}
