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
