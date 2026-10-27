import assert from 'node:assert/strict';
import { chromium } from '/app/node_modules/playwright/index.mjs';

const site = 'https://argos.lelouet.fr';
const authCookie = 'argos_account', renewalCookie = 'argos_account_renewal';
const seconds = () => Date.now() / 1000;
const expiry = cookie => JSON.parse(Buffer.from(cookie.value.split('.')[1], 'base64url')).exp;
let browser, context, csrf, signedIn = false, phase = 'browser-start';
const evidence = { status: 'FAILED', mode: 'real-ten-minute-timer', automaticRenewal: false, resumedWithoutAccessCookie: false };
try {
  assert.ok(process.env.ARGOS_CI_EMAIL && process.env.ARGOS_CI_PASSWORD);
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  phase = 'csrf';
  const bootstrap = await context.request.get(site + '/api/account/csrf');
  assert.equal(bootstrap.status(), 200);
  csrf = (await bootstrap.json()).csrf;
  phase = 'login';
  const login = await context.request.post(site + '/api/account/auth/login', {
    data: { email: process.env.ARGOS_CI_EMAIL, password: process.env.ARGOS_CI_PASSWORD },
    headers: { Origin: site, 'X-Argos-CSRF': csrf },
  });
  assert.equal(login.status(), 200);
  signedIn = true;
  assert.equal((await login.json()).verified, true);
  phase = 'cookie-lifetimes';
  const cookies = await context.cookies(site);
  const access = cookies.find(c => c.name === authCookie), renewal = cookies.find(c => c.name === renewalCookie);
  for (const cookie of [access, renewal]) assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Lax');
  assert.ok(expiry(access) - seconds() > 840 && expiry(access) - seconds() <= 905);
  const deadline = expiry(renewal);
  assert.ok(deadline - seconds() > 86340 && deadline - seconds() <= 86405);
  evidence.sessionLifetimeSeconds = Math.round(deadline - seconds());
  const page = await context.newPage();
  const isRenewal = response => new URL(response.url()).pathname === '/api/account/auth/renew' && response.request().method() === 'POST';
  phase = 'public-page-bootstrap';
  const initial = page.waitForResponse(isRenewal, { timeout: 30000 });
  await page.goto(site + '/');
  const initialResponse = await initial;
  assert.equal(initialResponse.status(), 200);
  assert.equal((await initialResponse.json()).accepted, true);
  const initialAccessExpiry = expiry((await context.cookies(site)).find(c => c.name === authCookie));
  const start = Date.now();
  phase = 'automatic-renewal';
  const automatic = await page.waitForResponse(response => isRenewal(response) && Date.now() - start >= 9 * 60000, { timeout: 11 * 60000 });
  assert.equal(automatic.status(), 200);
  assert.equal((await automatic.json()).accepted, true);
  assert.ok(expiry((await context.cookies(site)).find(c => c.name === authCookie)) >= initialAccessExpiry + 540);
  evidence.observedRenewalDelaySeconds = Math.round((Date.now() - start) / 1000);
  assert.equal((await context.request.get(site + '/api/account/me')).status(), 200);
  assert.equal(expiry((await context.cookies(site)).find(c => c.name === renewalCookie)), deadline);
  evidence.automaticRenewal = true;
  phase = 'resume-without-access-cookie';
  await context.clearCookies({ name: authCookie });
  const resumed = page.waitForResponse(isRenewal, { timeout: 30000 });
  await page.reload();
  const resumedResponse = await resumed;
  assert.equal(resumedResponse.status(), 200);
  assert.equal((await resumedResponse.json()).accepted, true);
  assert.equal((await context.request.get(site + '/api/account/me')).status(), 200);
  assert.equal(expiry((await context.cookies(site)).find(c => c.name === renewalCookie)), deadline);
  evidence.resumedWithoutAccessCookie = true;
  evidence.absoluteDeadlinePreserved = true;
  evidence.status = 'PASSED';
} catch {
  // No browser errors, DOM, tokens, credentials or screenshots in production evidence.
  evidence.failedPhase = phase;
  process.exitCode = 1;
} finally {
  if (signedIn) {
    try { await context.request.post(site + '/api/account/auth/logout', { data: {}, headers: { Origin: site, 'X-Argos-CSRF': csrf } }); }
    catch { /* Only this isolated CI session is affected; normal server expiry remains. */ }
  }
  await browser?.close();
  console.log(JSON.stringify(evidence));
}
