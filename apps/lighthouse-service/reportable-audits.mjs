import config from 'lighthouse/core/config/default-config.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/** Conservative inventory: a run may further mark a check informative/not applicable. */
export async function reportableAudits() {
  const active = new Set(['performance', 'accessibility', 'best-practices', 'seo']
    .flatMap(category => config.categories[category].auditRefs.map(ref => ref.id)));
  const audits = {};
  for (const entry of config.audits) {
    const path = typeof entry === 'string' ? entry : entry.path;
    if (!path) continue;
    const { default: Audit } = await import(`lighthouse/core/audits/${path}.js`);
    const meta = Audit.meta;
    if (!active.has(meta.id) || !['binary', 'numeric', 'metricSavings'].includes(meta.scoreDisplayMode ?? 'binary')) continue;
    const description = meta.description?.formattedDefault ?? meta.description ?? '';
    const links = [...description.matchAll(/\]\((https:\/\/[^)]+)\)/g)];
    audits[meta.id] = links.at(-1)?.[1] ?? 'https://developer.chrome.com/docs/lighthouse/overview';
  }
  return { lighthouseVersion: require('lighthouse/package.json').version,
    audits: Object.fromEntries(Object.entries(audits).sort(([a], [b]) => a.localeCompare(b))) };
}
