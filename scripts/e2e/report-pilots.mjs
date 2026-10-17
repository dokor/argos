import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';

// Start scripts/preview-report-pilots.mjs and a production Next build against it first.
const base = process.env.PILOT_WEB_URL ?? 'http://localhost:3029';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = 'outputs/ui-review/issue-673-pilots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const lang of ['fr', 'en']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const prefix = lang === 'en' ? '/en' : '';
    await page.goto(base + prefix + '/report/review-pilots-baseline?view=technical');
    await page.locator('[data-finding-guide]').first().waitFor({ state: 'attached' });
    const findings = page.locator('details[id^="finding-"]');
    assert.equal(await findings.count(), 4);
    for (let i = 0; i < 4; i++) {
      const row = findings.nth(i), summary = row.locator('summary').first();
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await row.getAttribute('open'), '');
      assert.equal(await summary.evaluate(el => document.activeElement === el), true);
      if (width === 390 && theme === 'dark') await row.screenshot({ path: `${output}/${lang}-mobile-${i}.png` });
      if (width === 1440 && theme === 'light') await row.screenshot({ path: `${output}/${lang}-desktop-${i}.png` });
    }
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${lang}/${theme}/${width}: overflow`);
    const texts = await page.locator('[data-finding-guide]').allTextContents();
    assert.ok(texts.every(text => text.includes(lang === 'fr' ? 'Méthode enregistrée' : 'Method recorded')));
    assert.deepEqual(errors, []);
    if (width === 1440) await page.screenshot({ path: `${output}/${lang}-${theme}-desktop.png`, fullPage: true });
    results.push({ lang, theme, width, keyboard: true, findings: 4, overflow: false, errors });
    await context.close();
  }

  for (const lang of ['fr', 'en']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 900 }, colorScheme: 'light' });
    const page = await context.newPage(), prefix = lang === 'en' ? '/en' : '';
    for (const variant of ['limits', 'source', 'breakdown', 'historical', 'partial', 'baseline']) {
      await page.goto(base + prefix + '/report/review-pilots-' + variant + '?view=technical');
      const findings = page.locator('details[id^="finding-"]');
      await findings.first().waitFor({ state: 'attached' });
      for (let i = 0; i < 4; i++) await findings.nth(i).locator('summary').first().click();
      const texts = await page.locator('[data-finding-guide]').allTextContents();
      if (variant === 'historical') assert.ok(texts.every(text => text.includes(lang === 'fr' ? 'méthode exacte' : 'exact method')));
      if (variant === 'source') assert.ok(texts.some(text => text.includes(lang === 'fr' ? 'source conservée est ZAP' : 'retained source is ZAP')));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${lang}/${variant}/320: overflow`);
      results.push({ lang, variant, width: 320, findings: 4, overflow: false });
      if (variant !== 'baseline' && variant !== 'historical') continue;
      const webTexts = await page.locator('[data-finding-guide]').allTextContents();
      const exportName = lang === 'fr' ? 'Exporter en PDF' : 'Export PDF';
      const exportPanel = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: exportName }) }).first();
      await exportPanel.locator('summary').click();
      await page.getByLabel(lang === 'fr' ? 'Format PDF' : 'PDF format').selectOption('full');
      const opened = page.waitForEvent('popup');
      await page.getByRole('button', { name: exportName, exact: true }).click();
      const popup = await opened;
      await popup.locator('[data-finding-guide]').first().waitFor();
      await popup.evaluate(() => document.fonts.ready);
      assert.deepEqual(await popup.locator('[data-finding-guide]').allTextContents(), webTexts);
      assert.equal(popup.url(), 'about:blank');
      assert.equal((await popup.content()).includes('review-pilots-'), false);
      await popup.emulateMedia({ media: 'print' });
      await popup.pdf({ path: `${output}/${lang}-${variant}-full.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: false, tagged: true });
      await popup.close();
    }
    await context.close();
  }
  await writeFile(`${output}/checks.json`, JSON.stringify(results, null, 2) + '\n');
  console.log(`${results.length} fictional report cases passed; 4 full PDFs exported with the same guide text as the web.`);
} finally { await browser.close(); }
