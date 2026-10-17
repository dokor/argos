import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function lighthouseInventory(config, version, specificKeys) {
  const rows = new Map();
  for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) {
    for (const ref of config.categories?.[category]?.auditRefs ?? []) {
      if (!/^[a-z0-9-]+$/.test(ref.id)) throw new Error('Invalid configured audit id');
      const key = 'lighthouse.audit.' + ref.id;
      if (!rows.has(key)) rows.set(key, { key, toolVersion: version, categories: [], content: specificKeys.has(key)
        ? 'specific-fr-en' : 'explicit-fallback-fr-en', selection: 'conditional-at-runtime' });
      rows.get(key).categories.push({ key: category, weight: ref.weight ?? 0, group: ref.group ?? null });
    }
  }
  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key, 'en'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  // Use the installed producer configuration, never a hand-maintained audit-id list.
  const moduleRoot = new URL('apps/lighthouse-service/node_modules/lighthouse/', root);
  const pkg = JSON.parse(readFileSync(new URL('package.json', moduleRoot), 'utf8'));
  const declared = JSON.parse(readFileSync(new URL('apps/lighthouse-service/package.json', root), 'utf8'));
  if (declared.dependencies.lighthouse !== pkg.version) throw new Error('Install the pinned Lighthouse version first');
  const { default: config } = await import(new URL('core/config/default-config.js', moduleRoot));
  const text = readFileSync(new URL('apps/console-web/src/components/report/findingPlaybooks.ts', root), 'utf8').replaceAll('\r\n', '\n');
  const start = text.indexOf(' = [', text.indexOf('export const playbookGroups')) + 3;
  const groups = JSON.parse(text.slice(start, text.indexOf(';\n\nexport const rulePlaybooks', start)));
  const rows = lighthouseInventory(config, pkg.version, new Set(groups.flatMap(g => g.keys)));
  const document = { note: 'Configured candidates, not observed production frequency. Actual emission also requires binary/numeric/metricSavings mode, score < 0.9 and selection within the first 12 diagnoses. Manual, informative, unavailable and passing results are not emitted.', rows };
  const output = new URL('docs/report/lighthouse-rule-inventory.json', root);
  const json = JSON.stringify(document, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !== json) throw new Error('Lighthouse inventory drift: regenerate with scripts/report-lighthouse-inventory.mjs');
  } else writeFileSync(output, json);
  console.log(`Lighthouse ${pkg.version}: ${rows.length} configured candidates, ${rows.filter(r => r.content === 'specific-fr-en').length} specific bilingual guides; remaining candidates use explicit fallback.`);
}
