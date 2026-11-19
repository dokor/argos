import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';
import { switchLanguage } from './language-menu.mjs';

const base = process.env.HEADER_BASE_URL ?? 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local frontend only');
const languages = ['fr','en','de','es','it','nl','pt','pl','sv','da','fi','cs','sk','hu','ro','bg','el','hr','sl','lt','lv','et'];
const evidence = [];
await mkdir('outputs/language-routing', { recursive: true });
for (const lang of languages) {
  const prefix = lang === 'fr' ? '' : '/' + lang;
  for (const route of ['/', '/account/sign-in', lang === 'fr' ? '/exemple-rapport' : '/example-report']) {
    const path = prefix + (route === '/' ? '' : route);
    // The URL must prevail over an untrusted incoming language header.
    const response = await fetch(base + (path || '/'), { headers: { 'x-argos-language': lang === 'en' ? 'fr' : 'en' } });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.equal(html.match(/<html[^>]* lang="([^"]+)"/)?.[1], lang, path + ': server-rendered language');
    if (route === '/account/sign-in') assert.match(response.headers.get('x-robots-tag'), /noindex/);
    evidence.push({ lang, path, serverLanguage: 'PASS' });
  }
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/api/account/session', route => route.fulfill({ json: { signedIn: false } }));
  await page.goto(base + '/');
  await switchLanguage(page, 'Deutsch');
  await page.waitForURL(base + '/de');
  assert.equal(await page.locator('html').getAttribute('lang'), 'de');
  await page.locator('nav[data-menu-open] a[href="/de/resources"]').click();
  await page.waitForURL(base + '/de/resources');
  await page.locator('h1').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'de', 'Client navigation retains the selected language');
  await switchLanguage(page, 'Български');
  await page.waitForURL(base + '/bg/resources');
  assert.equal(await page.locator('html').getAttribute('lang'), 'bg');
  await page.screenshot({ path: 'outputs/language-routing/bulgarian-resources.png' });
  await writeFile('outputs/language-routing/result.json', JSON.stringify({ evidence, languageSwitchAndClientNavigation: 'PASS' }, null, 2));
  console.log(`PASS: ${evidence.length} localized HTML responses, language switching and client navigation`);
} finally { await browser.close(); }
