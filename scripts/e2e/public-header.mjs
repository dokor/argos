import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';

const base = process.env.HEADER_BASE_URL ?? 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local frontend only');
const output = 'outputs/public-header';
await mkdir(output, { recursive: true });
const routes = {
  fr: ['/', '/faq', '/ressources', '/guides/checklist-audit-site-web', '/ressources/audit-technique-gratuit', '/ressources/accessibilite-numerique', '/ressources/audit-site-pme', '/ressources/audit-site-ecommerce', '/methodologie-score', '/exemple-rapport'],
  en: ['/en', '/en/faq', '/en/resources', '/en/resources/small-business-website-audit', '/en/resources/ecommerce-website-audit', '/en/example-report'],
};
const labels = { fr: ['Comment ça marche', 'Exemple de rapport', 'Guides', 'Analyser gratuitement'], en: ['How it works', 'Example report', 'Guides', 'Analyse for free'] };
const browser = await chromium.launch();
const evidence = [];

// Geometry of all stable controls, including the slot before admin hydration.
async function geometry(page) {
  return page.locator('nav').first().evaluate(nav => {
    const inner = nav.firstElementChild;
    const elements = [nav, inner, inner.children[0], inner.children[0].children[0], inner.children[0].children[1], inner.children[1], ...inner.children[1].children, inner.children[2], ...inner.children[2].children];
    return elements.map(el => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return [x, y, width, height].map(value => Math.round(value * 100) / 100);
    });
  });
}

// Chromium may round a few pixels on composited rounded controls differently.
// Bound that noise tightly; geometry remains exact and layout/text changes fail.
async function comparePixels(page, expected, actual) {
  if (expected.equals(actual)) return { count: 0, maxDelta: 0, fraction: 0 };
  return page.evaluate(async sources => {
    const images = await Promise.all(sources.map(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0);
        resolve({ width: img.width, height: img.height, data: context.getImageData(0, 0, img.width, img.height).data });
      };
      img.src = src;
    })));
    if (images[0].width !== images[1].width || images[0].height !== images[1].height) return { fraction: 1, maxDelta: 255 };
    let count = 0, maxDelta = 0;
    for (let i = 0; i < images[0].data.length; i += 4) {
      let differs = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(images[0].data[i + channel] - images[1].data[i + channel]);
        maxDelta = Math.max(maxDelta, delta);
        differs ||= delta > 0;
      }
      if (differs) count++;
    }
    return { count, maxDelta, fraction: count / (images[0].width * images[0].height) };
  }, [expected, actual].map(buffer => 'data:image/png;base64,' + buffer.toString('base64')));
}

async function ready(page, lang, admin) {
  const nav = page.locator('nav').first();
  await nav.waitFor();
  await page.waitForFunction(() => getComputedStyle(document.body).margin === '0px' && getComputedStyle(document.documentElement).overflowY === 'scroll');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector('nav button')?.getAttribute('aria-pressed') === String(document.documentElement.dataset.theme === 'dark'));
  await page.waitForFunction(lang => document.documentElement.lang === lang, lang);
  assert.deepEqual(await nav.locator(':scope > div > div').first().locator('a').allTextContents(), labels[lang]);
  assert.equal(await page.locator('nav').filter({ has: page.getByRole('link', { name: 'Argos', exact: true }) }).count(), 1);
  assert.equal(await nav.getByRole('group', { name: 'Language' }).count(), 1);
  if (admin) await nav.locator('a[href="/dashboard"]').waitFor();
  else assert.equal(await nav.locator('a[href="/dashboard"]').count(), 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.ok(await nav.evaluate(nav => nav.scrollWidth <= nav.clientWidth), 'Header must not overflow');
}

try {
  for (const width of [1280, 390, 320]) {
    let sharedGeometry;
    for (const theme of ['light', 'dark']) {
      for (const admin of [false, true]) {
        for (const lang of ['fr', 'en']) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
          // No backend, third-party service or real admin credential is needed.
          if (admin) await context.addCookies([{ name: 'argos_admin', value: 'synthetic-header-fixture', url: base }]);
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          let expected;
          let expectedPixels;
          const state = width + '-' + lang + '-' + theme + '-' + (admin ? 'admin' : 'visitor');
          for (const [index, route] of routes[lang].entries()) {
            const response = await page.goto(base + route);
            assert.equal(response.status(), 200, route);
            await ready(page, lang, admin);
            const actual = await geometry(page);
            expected ??= actual;
            assert.deepEqual(actual, expected, state + ' geometry: ' + route);
            sharedGeometry ??= actual;
            assert.deepEqual(actual, sharedGeometry, 'Language/theme/admin must not move controls: ' + state);
            const nav = page.locator('nav').first();
            await nav.screenshot({ animations: "disabled", path: output + '/' + state + '-' + index + '.png' });
            // Active styles and the page behind the translucent header intentionally differ.
            // Compare controls on a fixed opaque backing; retain the real capture above.
            await page.addStyleTag({ content: 'nav { background: var(--argos-bg) !important; backdrop-filter: none !important; } nav > div > div:first-of-type > a[aria-current] { color: var(--argos-text-muted) !important; box-shadow: none !important; }' });
            const pixels = await nav.screenshot({ animations: "disabled" });
            expectedPixels ??= pixels;
            const difference = await comparePixels(page, expectedPixels, pixels);
            const matches = difference.fraction <= 0.002 && difference.maxDelta <= 20;
            if (!matches) {
              await writeFile(output + '/expected.png', expectedPixels);
              await writeFile(output + '/actual.png', pixels);
            }
            assert.ok(matches, state + ' header pixels differ on ' + route + ': ' + JSON.stringify(difference));
            evidence.push({ state, route, geometry: actual, pixelDifference: difference });
          }
          // Real client transitions through the shared navigation.
          for (const index of [1, 2, 0, 3, 2, 1]) {
            const nav = page.locator('nav').first();
            const link = nav.locator(':scope > div > div').first().locator('a').nth(index);
            const href = await link.getAttribute('href');
            await link.click();
            await page.waitForURL(base + href);
            await ready(page, lang, admin);
            assert.deepEqual(await geometry(page), expected, 'Client navigation changed header geometry');
            const current = nav.locator(':scope > div > div').first().locator('a[aria-current="page"]');
            if (index === 1) assert.equal(await current.textContent(), labels[lang][index]);
            if (index === 2) assert.equal(await nav.locator('a[aria-current="location"]').textContent(), labels[lang][index]);
          }
          // Follow a content link as well, including the French guide.
          await page.locator('nav').first().locator(':scope > div > div').first().locator('a').nth(2).click();
          await page.waitForURL(base + routes[lang][2]);
          const linkedRoute = lang === 'fr' ? '/guides/checklist-audit-site-web' : '/en/resources/small-business-website-audit';
          await page.locator('main a[href="' + linkedRoute + '"]').first().click();
          await page.waitForURL(base + linkedRoute);
          await ready(page, lang, admin);
          assert.deepEqual(await geometry(page), expected, 'Content-link navigation moved header');
          assert.equal(await page.locator('nav').first().locator('a[aria-current="location"]').textContent(), labels[lang][2]);
          // Short page versus tall page: exercise an actual scrollbar transition.
          const before = await geometry(page);
          await page.addStyleTag({ content: 'main, footer { display: none !important; }' });
          assert.deepEqual(await geometry(page), before, 'Removing scrollable content moved header');
          assert.deepEqual(errors, [], 'Browser errors: ' + state);
          console.log("PASS " + state);
          await context.close();
        }
      }
    }
  }
  // Cover both sides of the responsive breakpoints.
  for (const width of [560, 561, 900, 901]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    let expected;
    for (const route of ['/', '/faq', '/ressources']) {
      await page.goto(base + route);
      await ready(page, 'fr', false);
      const actual = await geometry(page);
      expected ??= actual;
      assert.deepEqual(actual, expected, 'Breakpoint geometry changed between routes: ' + width);
    }
    await page.locator('nav').first().screenshot({ path: output + '/breakpoint-' + width + '.png' });
    await page.close();
  }
  // Cold font load and admin hydration: sample controls before/after each frame.
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await context.addCookies([{ name: 'argos_admin', value: 'synthetic-header-fixture', url: base }]);
  await context.route('**/*.woff2', async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue();
  });
  await context.addInitScript(() => {
    window.headerFrames = [];
    const start = performance.now();
    function sample() {
      const nav = document.querySelector('nav');
      if (nav && getComputedStyle(nav).position === 'sticky' && getComputedStyle(document.body).margin === '0px') {
        const inner = nav.firstElementChild;
        window.headerFrames.push([inner.children[0], inner.children[1], ...inner.children[2].children].map(el => {
          const { x, y, width, height } = el.getBoundingClientRect();
          return [x, y, width, height];
        }));
      }
      if (performance.now() - start < 2000) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const page = await context.newPage();
  await page.goto(base + '/');
  await ready(page, 'fr', true);
  await page.waitForFunction(() => window.headerFrames.length > 30);
  const frames = await page.evaluate(() => window.headerFrames);
  assert.ok(frames.length > 30);
  for (const frame of frames) assert.deepEqual(frame, frames[0], 'Font loading/admin hydration moved controls');
  const before = await geometry(page);
  await page.locator('nav').first().getByRole('button').click();
  assert.deepEqual(await geometry(page), before, 'Theme toggle moved controls');
  await page.locator('nav').first().getByRole('link', { name: 'English', exact: true }).click();
  await page.waitForURL(base + '/en');
  await ready(page, 'en', true);
  assert.deepEqual(await geometry(page), before, 'Language toggle moved controls');
  await context.close();
  await writeFile(output + '/evidence.json', JSON.stringify(evidence, null, 2));
  console.log('PASS: ' + evidence.length + ' route/state captures, client navigation, responsive breakpoints, scrollbar, hydration, fonts and toggles');
} finally {
  await browser.close();
}
