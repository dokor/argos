import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reportableAudits } from './reportable-audits.mjs';

test('every potentially reportable rule in the installed Lighthouse config is inventoried for editorial coverage', async () => {
  const catalogue = JSON.parse(await readFile(new URL('../console-web/src/components/report/lighthouseAuditCatalogue.json', import.meta.url), 'utf8'));
  assert.deepEqual(await reportableAudits(), catalogue,
    'Lighthouse rules changed: update the catalogue and add FR/EN problem, location, correction and verification guidance.');
});
