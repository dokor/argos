import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lighthouseInventory } from './report-lighthouse-inventory.mjs';

test('inventories configured dynamic ids without claiming they were emitted or reviewed', () => {
  const config = { categories: {
    performance: { auditRefs: [{ id: 'new-insight', weight: 0 }, { id: 'largest-contentful-paint', weight: 25 }] },
    accessibility: { auditRefs: [{ id: 'new-insight', weight: 1 }, { id: 'manual-review', group: 'manual' }] },
  } };
  const rows = lighthouseInventory(config, '13.5.0', new Set(['lighthouse.audit.largest-contentful-paint']));
  assert.equal(rows.length, 3);
  assert.equal(rows.find(r => r.key.endsWith('new-insight')).categories.length, 2);
  assert.equal(rows.find(r => r.key.endsWith('new-insight')).content, 'explicit-fallback-fr-en');
  assert.equal(rows.find(r => r.key.endsWith('largest-contentful-paint')).content, 'specific-fr-en');
  assert.ok(rows.every(r => r.selection === 'conditional-at-runtime'));
});
