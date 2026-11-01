import assert from 'node:assert/strict';

// Session maintenance is separate from the business mutations asserted by each recipe.
// Register after broad page routes; the read-only preview server still refuses writes.
export async function mockSessionRenewal(page, { signedIn = true } = {}) {
  await page.route('**/api/account/csrf', route => {
    assert.equal(route.request().method(), 'GET');
    return route.fulfill({ status: 200, json: { csrf: 'c'.repeat(43) } });
  });
  await page.route('**/api/account/auth/renew', route => {
    assert.equal(route.request().method(), 'POST');
    return route.fulfill({ status: signedIn ? 200 : 401,
      json: signedIn ? { accepted: true } : { error: 'session_invalid' } });
  });
}
