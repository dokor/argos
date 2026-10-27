import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const destination = new URL('../apps/api-backend/src/main/resources/tech/php-security.json', import.meta.url);
const version = String.raw`\d+\.\d+\.\d+`;

// PHP publishes one upper bound per release branch. Do not interpret <8.3.x
// as including 8.2.x: that branch has its own advisory entry and fix.
export function normalizeRanges(text) {
  const exact = text.trim().match(new RegExp(`^(${version})$`));
  if (exact) return [{ from: exact[1], to: exact[1], includeFrom: true, includeTo: true }];
  if (text.includes(' - ')) return text.split(',').map(part => {
    const match = part.trim().match(new RegExp(`^(${version}) - (${version})$`));
    if (!match) throw new Error(`Unrecognized PHP range: ${text}`);
    return { from: match[1], to: match[2], includeFrom: true, includeTo: true };
  });
  const parts = text.split(',').map(part => part.trim().match(new RegExp(`^(<=|>=|<|>)\\s*(${version})$`)));
  if (parts.some(part => !part)) throw new Error(`Unrecognized PHP range: ${text}`);
  const upper = parts.find(part => part[1].startsWith('<'));
  const lower = parts.find(part => part[1].startsWith('>'));
  if (!upper || parts.length > 2 || (parts.length === 2 && !lower)) throw new Error(`Unbounded PHP range: ${text}`);
  return [{ from: lower?.[2] ?? upper[2].replace(/\d+$/, '0'), to: upper[2],
    includeFrom: !lower || lower[1] === '>=', includeTo: upper[1] === '<=' }];
}

export function normalizeAdvisories(advisories, verifiedAt) {
  return advisories.filter(item => item.cve_id && !item.withdrawn_at && item.published_at.slice(0, 10) <= verifiedAt)
    .map(item => ({ cve: item.cve_id, url: item.html_url, severity: item.severity,
      ranges: item.vulnerabilities.flatMap(v => normalizeRanges(v.vulnerable_version_range)) }))
    .sort((a, b) => a.cve.localeCompare(b.cve));
}

async function refresh() {
  const current = JSON.parse(await readFile(destination, 'utf8'));
  let advisories = [];
  if (process.argv[2]) advisories = JSON.parse(await readFile(process.argv[2], 'utf8'));
  else for (let page = 1; ; page++) {
    const response = await fetch(`https://api.github.com/repos/php/php-src/security-advisories?per_page=100&page=${page}`,
      { headers: { 'User-Agent': 'Argos-PHP-security-catalogue', Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`PHP advisory fetch failed: ${response.status}`);
    const batch = await response.json();
    advisories.push(...batch);
    if (batch.length < 100) break;
  }
  const verifiedAt = new Date().toISOString().slice(0, 10);
  const normalized = normalizeAdvisories(advisories, verifiedAt);
  if (!normalized.length) throw new Error('Refusing to replace the PHP catalogue with no advisories');
  // Support dates are reviewed separately against php.net/supported-versions.php.
  const result = { ...current, advisoriesVerifiedAt: verifiedAt, advisories: normalized };
  await writeFile(destination, JSON.stringify(result, null, 2) + '\n');
  console.log(`Saved ${normalized.length} PHP advisories; review support dates before committing.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await refresh();
