import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sourceFiles = ["app.mjs","collector.mjs","worker.mjs","browser-policy.mjs","policy.mjs","evidence.mjs","measurement.mjs","package-lock.json"];
// Freeze collector code, pinned dependencies and runtime; no deployment label is trusted.
const implementation = createHash('sha256');
for (const file of sourceFiles) implementation.update(file).update(readFileSync(new URL(file, import.meta.url)));
const revision = implementation.digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function methodFingerprint(evidence) {
  return createHash('sha256').update(JSON.stringify(canonical({ revision, node: process.version,
    platform: process.platform, arch: process.arch, ...evidence }))).digest('hex');
}
export function scopeFingerprint(requested, destination) {
  if (typeof requested !== 'string' || typeof destination !== 'string') return null;
  try {
    if (![requested, destination].every(value => ['http:', 'https:'].includes(new URL(value).protocol))) return null;
  } catch { return null; }
  return createHash('sha256').update(JSON.stringify([requested, destination])).digest('hex');
}

export function lighthouseMethod(lhr, flags) {
  if (!lhr || !lhr.lighthouseVersion || !lhr.environment?.hostUserAgent
      || !lhr.configSettings || !Object.keys(lhr.configSettings).length) return null;
  return methodFingerprint({ lighthouseVersion: lhr.lighthouseVersion,
    browser: lhr.environment.hostUserAgent, settings: lhr.configSettings,
    maxWaitForLoad: flags.maxWaitForLoad, locale: flags.locale });
}
