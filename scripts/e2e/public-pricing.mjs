import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import { injectAxe } from './inject-axe.mjs';

const base = process.env.PRICING_BASE_URL ?? process.env.CONNECTED_BASE_URL ?? 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local fixture frontend only');
const output = 'outputs/ui-review/public-pricing';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(), results = [];
try {
  for (const width of [320, 390, 768, 1056, 1182, 1440]) for (const lang of ['fr', 'en']) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage(), writes = [], errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const request = route.request();
      if (request.method() !== 'GET') writes.push(new URL(request.url()).pathname);
      const path = new URL(request.url()).pathname;
      assert.ok(!path.includes('billing'), 'Pricing must not read a private billing snapshot');
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(path === '/api/account/session' ? { signedIn: false } : { enabled: false, choice: 'unset' }) });
    });
    await page.route('https://**/*', route => { external.push(new URL(route.request().url()).origin); return route.abort(); });
    const path = lang === 'fr' ? '/tarifs' : '/en/pricing';
    assert.equal((await page.goto(base + path)).status(), 200);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const state = `${width}-${lang}-${theme}`;
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('main article').count(), 3);
    assert.equal(await page.locator('#subscription-statuses dt').count(), 7);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Document overflow: ' + state);
    const ctas = await page.locator('main article a').evaluateAll(links => links.map(link => ({ height: link.getBoundingClientRect().height, top: link.getBoundingClientRect().top })));
    assert.ok(ctas.every(rect => rect.height >= 44), 'Touch targets: ' + state);
    if (width > 760 && Math.max(...ctas.map(rect => rect.top)) - Math.min(...ctas.map(rect => rect.top)) > 2) {
      await page.screenshot({ path: `${output}/alignment-${state}.png`, fullPage: true });
      const geometry = await page.locator('main article').evaluateAll(cards => cards.map(card => [...card.children].map(child => ({ tag: child.tagName, height: child.getBoundingClientRect().height }))));
      assert.fail('Card CTA alignment: ' + state + ' ' + JSON.stringify(geometry));
    }
    const nav = page.getByRole('navigation', { name: lang === 'fr' ? 'Navigation principale' : 'Main navigation' });
    if (width <= 760) await nav.getByRole('button', { name: lang === 'fr' ? 'Ouvrir le menu' : 'Open menu' }).click();
    const current = nav.getByRole('link', { name: lang === 'fr' ? 'Tarifs' : 'Pricing', exact: true });
    assert.equal(await current.getAttribute('aria-current'), 'page');
    assert.ok(await current.isVisible());
    if (width <= 760) await current.press('Escape');
    await page.getByRole('link', { name: lang === 'fr' ? 'Comparer les offres' : 'Compare plans', exact: true }).click();
    const heading = await page.locator('#comparison-title').boundingBox(), navigation = await nav.boundingBox();
    assert.ok(heading.y >= navigation.height - 1, 'Anchor hidden by sticky navigation: ' + state);
    const tableRegion = page.getByRole('region', { name: lang === 'fr' ? 'Tableau comparatif des offres' : 'Plan comparison table' });
    await tableRegion.focus();
    if (width < 768) { await tableRegion.press('ArrowRight'); await page.waitForFunction(() => document.querySelector('[role="region"]').scrollLeft > 0); }
    const question = page.locator('main details').first().locator('summary');
    await question.focus(); await question.press('Enter');
    assert.equal(await page.locator('main details').first().getAttribute('open'), '');
    assert.ok(await question.evaluate(el => getComputedStyle(el).outlineStyle !== 'none'), 'Visible keyboard focus: ' + state);
    await page.getByRole('link', { name: lang === 'fr' ? 'Être informé du lancement' : 'Hear about the launch', exact: true }).click();
    const waitlist = await page.locator('#premium-title').boundingBox();
    assert.ok(waitlist.y >= navigation.height - 1, 'Waiting list anchor: ' + state);
    assert.equal(await page.getByRole('checkbox', { name: /Premium/ }).isChecked(), false);
    await injectAxe(page);
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact })));
    assert.deepEqual(violations, [], 'Accessibility checks: ' + state);
    assert.deepEqual(writes, [], 'No financial, CI or other mutation from reading pricing');
    assert.deepEqual(external, [], 'No provider call from reading pricing');
    assert.deepEqual(errors, [], 'Client errors: ' + state);
    if ((width === 1440 && lang === 'fr') || (width === 390 && lang === 'en') || (width === 768 && lang === 'fr' && theme === 'light')) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${output}/${state}.png`, fullPage: true });
      if (width === 1440 && lang === 'fr' && theme === 'light') await page.screenshot({ path: `${output}/preview.png` });
    }
    results.push({ width, lang, theme, noMutation: true, noOverflow: true, keyboard: true, axe: 'pass' });
    await context.close();
  }
  await writeFile(output + '/results.json', JSON.stringify(results, null, 2));
  console.log(`Public pricing: ${results.length} responsive, language and theme cases passed`);
} finally { await browser.close(); }
