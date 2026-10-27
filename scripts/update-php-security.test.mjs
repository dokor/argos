import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRanges, normalizeAdvisories } from './update-php-security.mjs';

test('bounds advisories to their own PHP branch and retains inclusive/exclusive limits', () => {
  assert.deepEqual(normalizeRanges('< 8.3.36'), [{ from: '8.3.0', to: '8.3.36', includeFrom: true, includeTo: false }]);
  assert.deepEqual(normalizeRanges('> 8.1.11, < 8.1.28'), [{ from: '8.1.11', to: '8.1.28', includeFrom: false, includeTo: false }]);
  assert.deepEqual(normalizeRanges('>=8.2.0, <=8.2.2'), [{ from: '8.2.0', to: '8.2.2', includeFrom: true, includeTo: true }]);
  assert.equal(normalizeRanges('8.2.12')[0].to, '8.2.12');
  assert.equal(normalizeRanges('7.3.27 - 7.3.33, 7.4.15 - 7.4.33').length, 2);
  assert.throws(() => normalizeRanges('unknown'));
  assert.throws(() => normalizeRanges('>= 8.1.0'));
});

test('excludes withdrawn, unpublished and non-CVE advisories', () => {
  const entry = { cve_id: 'CVE-2026-1234', html_url: 'https://github.com/php/php-src/security/advisories/example',
    published_at: '2026-10-01', severity: 'high', vulnerabilities: [{ vulnerable_version_range: '< 8.3.36' }] };
  assert.equal(normalizeAdvisories([entry, { ...entry, withdrawn_at: '2026-10-02' },
    { ...entry, cve_id: null }, { ...entry, published_at: '2026-11-01' }], '2026-10-27').length, 1);
});
