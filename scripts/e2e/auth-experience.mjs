import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '../../apps/playwright-service/node_modules/playwright/index.mjs';

// Fixed local origins: never run against production or send real email.
const base = 'http://localhost:3000', api = 'http://127.0.0.1:33317';
const output = 'outputs/auth-experience';
await mkdir(output, {recursive:true});
const copy = Object.fromEntries(await Promise.all(['fr','en'].map(async lang => [lang, JSON.parse(await readFile(`apps/console-web/src/lib/i18n/${lang}.json`, 'utf8')).account])));
const browser = await chromium.launch({headless:true});
let stage = 'start';
const evidence = [];
async function title(page, lang, mode) {
  await page.waitForFunction(expected => document.title === expected, copy[lang].authTitles[mode]);
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
  assert.equal(await page.locator('meta[name="referrer"]').getAttribute('content'), 'no-referrer');
}
async function mail(email, lang, mode) {
  const response = await fetch(api + '/api/__test/mail/' + encodeURIComponent(email));
  assert.equal(response.status, 200, 'Captured email must exist');
  const {url} = await response.json(), parsed = new URL(url);
  assert.equal(parsed.origin, base);
  assert.equal(parsed.pathname, (lang === 'en' ? '/en' : '') + '/account/' + mode);
  assert.ok(parsed.hash.startsWith('#token='));
  return url;
}
try {
  for (const lang of ['fr','en']) {
    const context = await browser.newContext({viewport:{width:lang === 'fr' ? 1280 : 390,height:900},colorScheme:lang === 'fr' ? 'light' : 'dark'});
    const page = await context.newPage(), c = copy[lang], prefix = lang === 'en' ? '/en' : '';
    const email = `auth-${lang}-${Date.now()}@example.invalid`, password = 'synthetic account passphrase', changed = password + ' changed';
    const target = prefix + '/account/settings?section=profile';
    stage = lang + '-metadata';
    for (const mode of ['sign-in','register','forgot','reset','verify']) {
      stage = lang + '-metadata-' + mode;
      await page.goto(base + prefix + '/account/' + mode);
      await title(page, lang, mode);
    }
    stage = lang + '-registration';
    await page.goto(base + prefix + '/account/register?returnTo=' + encodeURIComponent(target));
    await page.getByLabel(c.name,{exact:true}).fill('Synthetic UX fixture');
    await page.getByLabel(c.email,{exact:true}).fill(email);
    await page.getByLabel(c.password,{exact:true}).fill(password);
    await page.getByRole('button',{name:c.register,exact:true}).click();
    await page.getByRole('status').filter({hasText:c.registrationSent}).waitFor();
    assert.equal(await page.locator('form').count(),0);
    await page.screenshot({path:`${output}/registration-sent-${lang}.png`});
    const verification = await mail(email,lang,'verify');
    stage = lang + '-verification';
    await page.goto(verification);
    await page.waitForURL(base + prefix + '/account/verify');
    await title(page,lang,'verify');
    // A language round trip must preserve both the memory-held token and the return context.
    for (const next of [lang === 'fr' ? 'en' : 'fr',lang]) {
      await page.getByRole('link',{name:next === 'fr' ? 'Français' : 'English',exact:true}).click();
      await title(page,next,'verify');
      await page.getByRole('button',{name:copy[next].verify,exact:true}).waitFor();
    }
    await page.getByRole('button',{name:c.verify,exact:true}).click();
    await page.getByRole('status').filter({hasText:c.verifiedDone}).waitFor();
    await page.getByRole('link',{name:c.backToSignIn,exact:true}).click();
    await title(page,lang,'sign-in');
    await page.getByLabel(c.email,{exact:true}).fill(email);
    await page.getByLabel(c.password,{exact:true}).fill(password);
    await page.getByRole('button',{name:c.signIn,exact:true}).click();
    await page.waitForURL(base + target);
    stage = lang + '-used-verification';
    await page.goto(verification);
    await page.getByRole('button',{name:c.verify,exact:true}).click();
    await page.getByRole('alert').filter({hasText:c.errors.token_invalid}).waitFor();
    assert.equal(await page.locator('form').count(),0);
    stage = lang + '-reset';
    await page.goto(base + prefix + '/account/forgot?returnTo=' + encodeURIComponent(target));
    await page.getByLabel(c.email,{exact:true}).fill(email);
    await page.getByRole('button',{name:c.sendResetLink,exact:true}).click();
    await page.getByRole('status').filter({hasText:c.forgotSent}).waitFor();
    const reset = await mail(email,lang,'reset');
    await page.goto(reset);
    await title(page,lang,'reset');
    await page.getByLabel(c.password,{exact:true}).fill(changed);
    await page.getByRole('button',{name:c.reset,exact:true}).click();
    await page.getByRole('status').filter({hasText:c.resetDone}).waitFor();
    await page.getByRole('link',{name:c.backToSignIn,exact:true}).click();
    await page.getByLabel(c.email,{exact:true}).fill(email);
    await page.getByLabel(c.password,{exact:true}).fill(changed);
    await page.getByRole('button',{name:c.signIn,exact:true}).click();
    await page.waitForURL(base + target);
    stage = lang + '-used-reset';
    await page.goto(reset);
    await page.getByLabel(c.password,{exact:true}).fill(changed);
    await page.getByRole('button',{name:c.reset,exact:true}).click();
    await page.getByRole('alert').filter({hasText:c.errors.token_invalid}).waitFor();
    assert.equal(await page.locator('form').count(),0);
    stage = lang + '-client-history';
    await page.goto(base + prefix + '/account/register');
    await page.getByRole('link',{name:c.signIn,exact:true}).click();
    await title(page,lang,'sign-in');
    await page.goBack();
    await title(page,lang,'register');
    evidence.push({lang,registration:'PASS',capturedEmail:'PASS',verification:'PASS',loginDestination:'PASS',reset:'PASS',usedLinks:'PASS',titlesAndHistory:'PASS'});
    await context.close();
  }
  await writeFile(`${output}/result.json`,JSON.stringify({status:'PASS',fixture:'real Java/MariaDB with local mail capture',evidence},null,2));
  console.log('PASS: FR/EN registration, captured email, verification, login, reset, used links, localized context and document titles.');
} catch {
  // Do not put email links or credentials from assertion messages into CI logs.
  await writeFile(`${output}/result.json`,JSON.stringify({status:'FAIL',stage},null,2));
  console.error('Authentication UX fixture failed at stage: ' + stage);
  process.exitCode = 1;
} finally { await browser.close(); }
