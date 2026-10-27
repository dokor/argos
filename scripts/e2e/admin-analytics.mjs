import { mockSessionRenewal } from './session-renewal-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';

const base = process.env.HEADER_BASE_URL ?? 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local frontend only');
const output = 'outputs/ui-review/account-journey';
await mkdir(output, { recursive: true });
// Run the read-only preview backend on 3018 and build/start Next with that API_BASE.
const channel = process.env.PLAYWRIGHT_CHANNEL;
assert.ok(!channel || ["chrome", "msedge"].includes(channel), "Supported local browser channel only");
const browser = await chromium.launch(channel ? { channel } : {});
const evidence = [];
try {
  for (const width of [320, 390, 768, 1280]) for (const lang of ['fr', 'en']) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
    await context.addCookies([{ name: 'argos_account', value: 'synthetic-review-session', url: base, httpOnly: true }]);
    const page = await context.newPage(), requests = [], errors = [];
    await mockSessionRenewal(page);
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    const route = (lang === 'en' ? '/en' : '') + '/account/admin/analytics';
    assert.equal((await page.goto(base + route)).status(), 200);
    await page.locator('main dl dd').filter({ hasText: /^24$/ }).waitFor();
    await page.getByRole('heading', { name: lang === 'fr' ? 'Du compte au premier usage' : 'From registration to first use', exact: true }).waitFor();
    await page.getByRole('region', { name: lang === 'fr' ? 'Retours après inscription' : 'Returns after registration', exact: true }).getByText(lang === 'fr' ? 'Indisponible' : 'Unavailable', { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('main').count(), 1);
    assert.equal(await page.locator('nav a[href$="/dashboard"]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, 'Page overflow');
    assert.ok((await page.locator('main').getByRole('link').first().getAttribute('href')).endsWith('/account/admin'));
    const languageLink = page.getByRole('group', { name: 'Language', exact: true }).getByRole('link', { name: lang === 'fr' ? 'English' : 'Français', exact: true });
    assert.equal(await languageLink.getAttribute('href'), (lang === 'fr' ? '/en' : '') + '/account/admin/analytics');
    const settings = page.locator('summary').filter({ hasText: lang === 'fr' ? 'Réglages de collecte' : 'Collection settings' });
    await settings.press('Enter');
    await page.getByRole('button', { name: lang === 'fr' ? 'Actualiser l’état de collecte' : 'Refresh collection state', exact: true }).waitFor();
    await settings.press('Enter');
    const periodResponse = page.waitForResponse(response => response.url().includes('/api/account/admin/analytics?days=7'));
    await page.getByRole('combobox').selectOption('7');
    await periodResponse;
    await page.locator('main dl dd').filter({ hasText: /^24$/ }).waitFor();
    const before = requests.filter(url => url.includes('/api/account/admin/analytics')).length;
    const refreshResponse = page.waitForResponse(response => response.url().includes('/api/account/admin/analytics?days=7'));
    await page.getByRole('button', { name: lang === 'fr' ? 'Actualiser' : 'Refresh', exact: true }).click();
    await refreshResponse;
    await page.locator('main dl dd').filter({ hasText: /^24$/ }).waitFor();
    assert.ok(requests.filter(url => url.includes('/api/account/admin/analytics')).length > before);
    assert.equal(requests.some(url => url.includes('/api/auth/')), false);
    const retention = page.getByRole('region', { name: lang === 'fr' ? 'Retours après inscription' : 'Returns after registration', exact: true });
    assert.equal(await retention.getByText(lang === 'fr' ? 'Indisponible' : 'Unavailable', { exact: true }).count(), 2, 'Seven-day cohorts must stay immature');
    const restored = page.waitForResponse(response => response.url().includes('/api/account/admin/analytics?days=30'));
    await page.getByRole('combobox').selectOption('30'); await restored;
    await page.locator('main dl dd').filter({ hasText: /^24$/ }).waitFor();
    await page.screenshot({ path: output + '/analytics-' + width + '-' + lang + '-' + theme + '.png', fullPage: true });
    if (width === 1280 && lang === "fr" && theme === "light") await page.screenshot({ path: output + "/analytics-desktop-preview.png" });
    await page.route('**/api/account/admin/analytics?*', request => request.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"admin_required"}' }));
    await page.getByRole('button', { name: lang === 'fr' ? 'Actualiser' : 'Refresh', exact: true }).click();
    await page.locator('main').getByRole('alert').waitFor();
    assert.equal(await page.getByRole('combobox').count(), 0);
    assert.equal(await page.locator('main dl').count(), 0, 'Private data remained after denial');
    assert.deepEqual(errors, []);
    evidence.push({ width, lang, theme, route, browser: browser.version(), channel: channel ?? "chromium", period: 7, capturePeriod: 30, keyboardSettings: true, refreshed: true, roleRefusal: true });
    console.log('PASS ' + width + '-' + lang + '-' + theme);
    await context.close();
  }
  for (const [name, profile, status] of [['anonymous', null, 401], ['user', { displayName: 'Review user', email: 'review@example.test', verified: true, admin: false }, 200], ['pending', { displayName: 'Review pending', email: 'pending@example.test', verified: false, admin: true }, 200]]) {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'argos_admin', value: 'obsolete-synthetic-cookie', url: base, httpOnly: true }]);
    await context.route('**/api/account/me', request => request.fulfill({ status, contentType: 'application/json', body: JSON.stringify(profile ?? { error: 'session_invalid' }) }));
    const page = await context.newPage(), requests = [];
    await mockSessionRenewal(page);
    page.on('request', request => requests.push(request.url()));
    await page.goto(base + '/account/admin/analytics');
    if (name === 'anonymous') await page.getByRole('heading', { name: 'Connectez-vous à votre espace', exact: true }).waitFor();
    else await page.locator('main').getByRole('alert').waitFor();
    console.log('PASS denied profile ' + name);
    assert.equal(requests.some(url => url.includes('/api/account/admin/analytics')), false, name);
    assert.equal(await page.locator('main dl').count(), 0);
    await context.close();
  }
  for (const lang of ['', '/en']) for (const from of ['/dashboard', '/dashboard/analytics', '/dashboard/report/401', '/login']) {
    const response = await fetch(base + lang + from, { redirect: 'manual' });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
  }
  for (const route of ['/api/audits', '/api/audits/runs/401/report', '/api/audits/201/history']) {
    assert.equal((await fetch(base + route, { headers: { Cookie: 'argos_admin=obsolete-synthetic-cookie' } })).status, 410);
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + '/'); await page.locator('nav').first().waitFor();
  await page.goto(base + '/report/review-complete-fixture');
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.equal(await page.locator('h1').count(), 1);
  await context.close();
  await writeFile(output + '/admin-analytics-evidence.json', JSON.stringify(evidence, null, 2));
  console.log('PASS: 16 responsive language/theme states, 3 denied profiles, removed routes, retired APIs, home and shared report');
} finally { await browser.close(); }
