import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';

const base = process.env.HEADER_BASE_URL ?? 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local frontend only');
const output = 'outputs/public-header';
await mkdir(output, { recursive: true });
const translations = {};
for (const lang of ['fr', 'en']) translations[lang] = JSON.parse(await readFile('apps/console-web/src/lib/i18n/' + lang + '.json', 'utf8'));
const routes = {
  fr: ['/', '/faq', '/ressources', '/guides/checklist-audit-site-web', '/ressources/audit-technique-gratuit', '/ressources/accessibilite-numerique', '/ressources/audit-site-pme', '/ressources/audit-site-ecommerce', '/methodologie-score', '/exemple-rapport'],
  en: ['/en', '/en/faq', '/en/resources', '/en/resources/small-business-website-audit', '/en/resources/ecommerce-website-audit', '/en/example-report'],
};
const browser = await chromium.launch();
const evidence = [];
async function checkLayout(page, copy, signedIn, mobile) {
  const nav = page.locator('nav').first();
  const account = nav.getByRole('link', { name: signedIn ? copy.account.title : copy.nav.signUp, exact: true });
  const audit = nav.getByRole('link', { name: copy.nav.freeAudit, exact: true });
  await account.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await account.isVisible(), 'Account text must remain visible');
  assert.ok(await audit.isVisible(), 'Audit CTA must remain visible');
  assert.ok((await account.getAttribute('href')).endsWith(signedIn ? '/account' : '/account/register'));
  const layout = await nav.evaluate(el => {
    const audit = el.querySelector('a[href$="#audit"]');
    const account = el.querySelector('a[href$="/account"],a[href$="/account/register"]');
    return {
      overflow: el.scrollWidth > el.clientWidth,
      actions: [audit, account].map(link => {
        const bounds = link.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(link.querySelector('span') ?? link);
        const text = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, rows: new Set(text.map(rect => Math.round(rect.top))).size };
      }),
    };
  });
  assert.equal(layout.overflow, false, 'Header must not overflow');
  for (const action of layout.actions) {
    assert.ok(action.height >= 44, 'Action must have a 44px target');
    assert.equal(action.rows, 1, 'Action label must stay on one line');
  }
  assert.equal(await nav.getByRole('button', { name: copy.nav.openMenu }).isVisible(), mobile);
  return layout.actions.map(({ rows, ...geometry }) => geometry);
}
try {
  for (const width of [280, 320, 390, 760, 761, 1100, 1101, 1182, 1280]) {
    for (const lang of ['fr', 'en']) {
      for (const theme of ['light', 'dark']) {
        const copy = translations[lang], mobile = width <= 760;
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
        let signedIn = false;
        await context.route('**/api/account/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn }) }));
        // Header visibility follows the verified session response, not cookie presence.
        // Server-side validation of real HttpOnly cookies is covered by account/session tests.
        await context.route('**/api/auth/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isAdmin: true }) }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const state = width + '-' + lang + '-' + theme;
        let expected;
        // Check all public routes at desktop/mobile representative sizes; breakpoints on home.
        const selectedRoutes = [320, 1280].includes(width) ? routes[lang] : routes[lang].slice(0, 1);
        for (const route of selectedRoutes) {
          const response = await page.goto(base + route);
          assert.equal(response.status(), 200, route);
          const actual = await checkLayout(page, copy, false, mobile);
          expected ??= actual;
          assert.deepEqual(actual, expected, 'Actions moved between routes: ' + state + route);
          evidence.push({ state, route, geometry: actual });
        }
        await page.locator('nav').first().screenshot({ path: output + '/' + state + '.png' });
        signedIn = true;
        await page.evaluate(() => window.dispatchEvent(new Event('argos-account-login')));
        assert.deepEqual(await checkLayout(page, copy, true, mobile), expected, 'Login moved actions');
        signedIn = false;
        await page.evaluate(() => window.dispatchEvent(new Event('argos-account-invalid')));
        assert.deepEqual(await checkLayout(page, copy, false, mobile), expected, 'Logout moved actions');
        const nav = page.locator('nav').first();
        if (mobile) {
          const toggle = nav.locator('button[aria-controls="site-nav-links site-nav-preferences"]');
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
          await nav.getByRole('link', { name: copy.nav.guides, exact: true }).waitFor();
          assert.ok(await nav.getByRole('group', { name: 'Language' }).isVisible());
          const consoleLink = nav.getByRole('link', { name: copy.nav.openConsole });
          await consoleLink.waitFor({ state: 'visible' });
          assert.ok(await consoleLink.isVisible());
          assert.ok(await nav.evaluate(el => el.scrollWidth <= el.clientWidth));
          await nav.screenshot({ path: output + '/' + state + '-menu.png' });
          await page.keyboard.press('Escape');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
          assert.ok(await toggle.evaluate(el => el === document.activeElement));
          await toggle.click();
        }
        await nav.getByRole('link', { name: copy.nav.guides, exact: true }).click();
        await page.waitForURL(base + (lang === 'fr' ? '/ressources' : '/en/resources'));
        await checkLayout(page, copy, false, mobile);
        if (mobile) assert.equal(await page.locator('nav').first().getByRole('button', { name: copy.nav.openMenu }).getAttribute('aria-expanded'), 'false');
        assert.deepEqual(errors, [], 'Browser errors: ' + state);
        console.log('PASS ' + state);
        await context.close();
      }
    }
  }
  await writeFile(output + '/evidence.json', JSON.stringify(evidence, null, 2));
  console.log('PASS: ' + evidence.length + ' route/state checks, responsive menu, login/logout and stable actions');
} finally { await browser.close(); }
