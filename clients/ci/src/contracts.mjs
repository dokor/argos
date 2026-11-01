import { schemas, policy, catalogue, errors } from './resources.mjs';
import { validPolicy, validVerdict } from '../../../apps/console-web/src/lib/ci-verdict-contract.mjs';

export const exact = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export const digest = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const timestamp = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v) && Number.isFinite(Date.parse(v));

// Deliberately limited to the supported OpenAPI response schemas. No remote refs/eval.
function shape(v, s, depth = 0) {
  if (!s || depth > 20) return false;
  if (s.$ref) return s.$ref.startsWith('#/components/schemas/') && shape(v, schemas[s.$ref.split('/').at(-1)], depth + 1);
  if (Object.hasOwn(s, 'const') && JSON.stringify(v) !== JSON.stringify(s.const)) return false;
  if (s.enum && !s.enum.includes(v)) return false;
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  const matches = t => t === 'null' ? v === null : t === 'array' ? Array.isArray(v)
    : t === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v)
    : t === 'integer' ? Number.isSafeInteger(v) : typeof v === t;
  if (types.length && !types.some(matches)) return false;
  if (typeof v === 'number' && (!Number.isFinite(v) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))) return false;
  if (typeof v === 'string' && (v.length > (s.maxLength ?? 4096) || s.pattern && !new RegExp(s.pattern).test(v)
    || s.format === 'date-time' && !timestamp(v) || s.format === 'uri' && !targetUrl(v))) return false;
  if (Array.isArray(v) && (v.length < (s.minItems ?? 0) || v.length > (s.maxItems ?? 256)
    || s.uniqueItems && new Set(v.map(x => JSON.stringify(x))).size !== v.length
    || !v.every(x => shape(x, s.items, depth + 1)))) return false;
  if (v !== null && typeof v === 'object' && !Array.isArray(v) && s.properties) {
    if (s.additionalProperties !== false || !exact(v, s.required) || !Object.entries(v).every(([k, x]) => shape(x, s.properties[k], depth + 1))) return false;
  }
  return true;
}

/** Syntactic check only: target DNS and ownership are exclusively server decisions. */
export function targetUrl(value) {
  try {
    if (typeof value !== 'string' || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return false;
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.search && !u.hash
      && !/[?#]/.test(value) && u.hostname.includes('.') && /^[a-z0-9.-]+$/.test(u.hostname)
      && !/^\d[\d.]*$/.test(u.hostname) && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname);
  } catch { return false; }
}
function unique(rows) { return new Set(rows.map(x => x.key)).size === rows.length; }
function usage(v) { return v.available === Math.max(0, v.limit - v.used - v.reserved); }
export function validResponse(kind, value, expected) {
  if (kind === 'VerdictPolicy') return validPolicy(value, policy);
  if (kind === 'Verdict') return validVerdict(value, policy, catalogue, errors) && value.admissionId === expected.id && value.sampleCount === expected.samples;
  if (!shape(value, schemas[kind])) return false;
  if (kind === 'Admission') return value.samples === expected.samples && (!expected.id || value.id === expected.id)
    && value.runs.length === value.samples && value.runs.every((r, i) => r.sample === i + 1 && r.failureCode === (r.status === 'FAILED' ? 'RUN_FAILED' : null)
      && BigInt(r.id) <= 9223372036854775807n) && new Set(value.runs.map(r => r.id)).size === value.samples;
  if (kind === 'Preflight') return usage(value.usage) && value.targets.every(t => new URL(t.origin).origin === t.origin);
  if (kind === 'Identity') return value.origins.every(o => new URL(o).origin === o);
  if (kind === 'Report') return value.runId === expected && BigInt(value.runId) <= 9223372036854775807n;
  if (kind === 'Export') return validResponse('Report', value.summary, expected) && value.reportPath === `/api/ci/v1/runs/${expected}/report`
    && ['categories', 'checks', 'findings'].every(k => unique(value.details[k]))
    && ['checks', 'findings'].every(k => value.details[k].every(r => r.category === catalogue[r.key]));
  return false;
}
