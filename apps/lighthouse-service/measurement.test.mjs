import test from 'node:test';
import assert from 'node:assert/strict';
import { lighthouseMethod, scopeFingerprint } from './measurement.mjs';

test('effective Lighthouse version, browser, settings and limits define the method', () => {
  const lhr = { lighthouseVersion: '13.5.0', environment: { hostUserAgent: 'Chrome/123' },
    configSettings: { formFactor: 'mobile', throttling: { cpuSlowdownMultiplier: 4 } } };
  const flags = { maxWaitForLoad: 45000, locale: 'fr' };
  const first = lighthouseMethod(lhr, flags);
  assert.match(first, /^[a-f0-9]{64}$/);
  for (const changed of [
    { ...lhr, lighthouseVersion: '14.0.0' },
    { ...lhr, environment: { hostUserAgent: 'Chrome/124' } },
    { ...lhr, configSettings: { ...lhr.configSettings, formFactor: 'desktop' } },
    { ...lhr, configSettings: { ...lhr.configSettings, throttling: { cpuSlowdownMultiplier: 1 } } }
  ]) assert.notEqual(lighthouseMethod(changed, flags), first);
  assert.notEqual(lighthouseMethod(lhr, { ...flags, maxWaitForLoad: 10000 }), first);
  assert.equal(lighthouseMethod({ ...lhr, categories: { performance: { score: 0.9 } }, fetchTime: 'later' }, flags), first);
  assert.equal(lighthouseMethod({ ...lhr, configSettings: undefined }, flags), null);
  assert.equal(lighthouseMethod({ ...lhr, environment: {} }, flags), null);
});

test('exact scope survives URL redaction without disclosing secrets', () => {
  const first = scopeFingerprint('https://example.com/', 'https://example.com/a?token=one');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, scopeFingerprint('https://example.com/', 'https://example.com/b?token=one'));
  assert.notEqual(first, scopeFingerprint('https://example.com/', 'https://example.com/a?token=two'));
  assert.equal(scopeFingerprint('https://example.com/', 'about:blank'), null);
  assert.equal(scopeFingerprint('https://example.com/', null), null);
});
