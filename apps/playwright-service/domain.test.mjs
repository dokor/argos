import assert from 'node:assert/strict';
import test from 'node:test';
import { isFirstPartyUrl, partitionNetworkErrors, registrableDomain } from './domain.mjs';

test('classifies no network error as empty first-party and third-party buckets', () => {
  assert.deepEqual(partitionNetworkErrors({}, 'https://www.example.com'), {
    failedRequests: { firstParty: 0, thirdParty: 0 },
    status5xx: { firstParty: 0, thirdParty: 0 }
  });
});

test('does not attribute a third-party-only network error to the audited site', () => {
  assert.deepEqual(partitionNetworkErrors({
    failedRequestUrls: ['https://cdn.other.test/script.js'],
    status5xxUrls: ['https://api.other.test/track']
  }, 'https://www.example.test'), {
    failedRequests: { firstParty: 0, thirdParty: 1 },
    status5xx: { firstParty: 0, thirdParty: 1 }
  });
});

test('attributes a first-party-only network error to the audited site', () => {
  assert.deepEqual(partitionNetworkErrors({
    failedRequestUrls: ['https://api.example.test/data'],
    status5xxUrls: ['https://cdn.example.test/app.js']
  }, 'https://www.example.test'), {
    failedRequests: { firstParty: 1, thirdParty: 0 },
    status5xx: { firstParty: 1, thirdParty: 0 }
  });
});

test('keeps mixed network errors in their separate diagnostic buckets', () => {
  assert.deepEqual(partitionNetworkErrors({
    failedRequestUrls: ['https://api.example.test/data', 'https://ads.other.test/pixel'],
    status5xxUrls: ['https://www.example.test/api', 'https://cdn.other.test/script.js']
  }, 'https://example.test'), {
    failedRequests: { firstParty: 1, thirdParty: 1 },
    status5xx: { firstParty: 1, thirdParty: 1 }
  });
});

test('uses the final URL after a redirect and recognises compound public suffixes', () => {
  assert.equal(registrableDomain('assets.shop.example.co.uk'), 'example.co.uk');
  assert.equal(isFirstPartyUrl('https://cdn.example.co.uk/app.js', 'https://www.example.co.uk'), true);
  assert.equal(isFirstPartyUrl('https://evil.co.uk/app.js', 'https://www.example.co.uk'), false);

  assert.deepEqual(partitionNetworkErrors({
    failedRequestUrls: ['https://cdn.example.co.uk/app.js'],
    status5xxUrls: ['https://tracker.other.co.uk/pixel']
  }, 'https://www.example.co.uk'), {
    failedRequests: { firstParty: 1, thirdParty: 0 },
    status5xx: { firstParty: 0, thirdParty: 1 }
  });
});

test('private PSL suffixes separate tenants while grouping their own subdomains', () => {
  for (const suffix of ['github.io', 'blogspot.com', 's3.amazonaws.com']) {
    assert.equal(registrableDomain(`cdn.alice.${suffix}`), `alice.${suffix}`);
    assert.equal(isFirstPartyUrl(`https://bob.${suffix}/app.js`, `https://alice.${suffix}`), false);
    assert.equal(isFirstPartyUrl(`https://cdn.alice.${suffix}/app.js`, `https://alice.${suffix}`), true);
    assert.equal(isFirstPartyUrl(`https://alice.${suffix}/app.js`, `https://${suffix}`), false);
  }
});

test('PSL wildcard and exception rules determine registrable domains', () => {
  assert.equal(registrableDomain('cdn.alice.co.za'), 'alice.co.za');
  assert.equal(isFirstPartyUrl('https://alice.co.za', 'https://bob.co.za'), false);
  assert.equal(registrableDomain('cdn.alice.foo.ck'), 'alice.foo.ck');
  assert.equal(isFirstPartyUrl('https://alice.foo.ck', 'https://bob.foo.ck'), false);
  assert.equal(registrableDomain('cdn.www.ck'), 'www.ck');
  assert.equal(isFirstPartyUrl('https://cdn.www.ck', 'https://www.ck'), true);
});

test('host normalization and exact IP comparisons remain compatible', () => {
  assert.equal(registrableDomain(' CDN.ALICE.GITHUB.IO. '), 'alice.github.io');
  assert.equal(isFirstPartyUrl('https://cdn.bücher.de/a', 'https://xn--bcher-kva.de'), true);
  assert.equal(isFirstPartyUrl('https://192.0.2.1/a', 'https://192.0.2.1'), true);
  assert.equal(isFirstPartyUrl('https://192.0.2.1/a', 'https://192.0.2.2'), false);
  assert.equal(isFirstPartyUrl('https://[2001:db8::1]/a', 'https://[2001:db8::1]'), true);
  assert.equal(isFirstPartyUrl('https://[2001:db8::1]/a', 'https://[2001:db8::2]'), false);
  assert.equal(isFirstPartyUrl('invalid', 'https://example.com'), false);
});
