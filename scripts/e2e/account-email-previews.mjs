// Local synthetic HTML regression checks. This does not emulate a mail client.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../apps/playwright-service/node_modules/playwright/index.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const previews = path.resolve(root, process.env.EMAIL_PREVIEW_DIR ?? 'outputs/account-email-preview');
const output = path.resolve(root, process.env.EMAIL_PREVIEW_SCREENSHOT_DIR ?? 'outputs/ui-review/account-email');
const kinds = ['verify', 'reset', 'reauth', 'password_changed', 'method_added', 'method_removed'];
const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await mkdir(output, {recursive: true});
  for (const kind of kinds) for (const language of ['fr', 'en']) {
    const html = await readFile(path.join(previews, `${kind}-${language}.html`), 'utf8');
    for (const width of [320, 390, 768, 1440]) {
      for (const mode of ['light', 'dark', 'inline']) {
        await page.setViewportSize({width, height: 900});
        await page.emulateMedia({colorScheme: mode === 'dark' ? 'dark' : 'light'});
        await page.setContent(html);
        // A sanitizer may retain table/element styles while discarding the document wrapper.
        // Keep the actual inline HTML; do not inject replacement CSS or impersonate Gmail/Outlook.
        if (mode === 'inline') await page.evaluate(() => {
          document.querySelectorAll('style').forEach(style => style.remove());
          document.body.removeAttribute('style');
        });
        const layout = await page.evaluate(() => {
          const paragraph = document.querySelector('.body-cell > p');
          const button = document.querySelector('.body-cell table a');
          const code = document.querySelector('.code');
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            font: getComputedStyle(paragraph).fontFamily,
            fontSize: parseFloat(getComputedStyle(paragraph).fontSize),
            buttonHeight: button?.getBoundingClientRect().height ?? null,
            code: code?.textContent ?? null,
            links: [...document.querySelectorAll('a')].map(link => link.getAttribute('href')),
          };
        });
        const label = `${kind}-${language} ${width}px ${mode}`;
        assert.equal(layout.overflow, false, `${label}: horizontal overflow`);
        assert.match(layout.font, /Arial/i, `${label}: typography lost without the document wrapper`);
        assert.ok(layout.fontSize >= 16, `${label}: main copy smaller than 16px`);
        if (kind === 'reauth') {
          assert.equal(layout.code, 'synthetic_' + 'x'.repeat(33), `${label}: copyable code changed`);
          assert.equal(layout.buttonHeight, null);
        } else {
          assert.ok(layout.buttonHeight >= 44, `${label}: action target smaller than 44px`);
          const account = `https://argos.example${language === 'en' ? '/en' : ''}/account`;
          const destination = ['verify', 'reset'].includes(kind)
            ? `${account}/${kind}#token=synthetic_${'x'.repeat(33)}` : `${account}/settings`;
          assert.equal(layout.links.filter(link => link === destination).length, 2, `${label}: button/fallback destination`);
        }
        // Small, representative, synthetic evidence; the full matrix goes in the JSON report.
        if ((width === 320 && (kind === 'verify' || kind === 'reauth')) || (width === 1440 && kind === 'reset' && language === 'en')) {
          await page.screenshot({path: path.join(output, `${kind}-${language}-${width}-${mode}.png`), fullPage: true});
        }
        results.push({kind, language, width, mode, ...layout});
      }
    }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({scope: 'synthetic Chromium previews only', results}, null, 2) + '\n');
  console.log(`${results.length} synthetic email layouts passed; Gmail, Outlook, Apple Mail and delivery remain separate checks.`);
} finally {
  await browser.close();
}
