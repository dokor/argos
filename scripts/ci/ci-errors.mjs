// Shared protocol foundation for the future Premium client/publishers, not the internal self-audit.
import { readFileSync } from 'node:fs';

const resource = name => JSON.parse(readFileSync(new URL(
  `../../apps/api-backend/src/main/resources/ci/${name}`, import.meta.url), 'utf8'));
const catalog = resource('error-catalog-v1.json').errors;
export const MAX_ERROR_BYTES = 4096;
const maxRetrySeconds = 2764800;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const delayCodes = new Set(['QUOTA_EXCEEDED', 'RATE_LIMITED', 'CAPACITY_UNAVAILABLE',
  'UPSTREAM_UNAVAILABLE', 'PUBLICATION_RATE_LIMITED']);
const own = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Reject unknown fields/versions and inconsistent metadata. Never return received prose. */
function decode(bytes, contentType, httpStatus) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType ?? '')) return null;
  if (!(typeof bytes === 'string' || bytes instanceof Uint8Array)) return null;
  if ((typeof bytes === 'string' ? Buffer.byteLength(bytes) : bytes.byteLength) > MAX_ERROR_BYTES) return null;
  try {
    const text = typeof bytes === 'string' ? bytes : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const data = JSON.parse(text);
    if (!own(data, ['schemaVersion', 'requestId', 'error']) || data.schemaVersion !== 1
      || typeof data.requestId !== 'string' || !uuid.test(data.requestId)) return null;
    const error = data.error;
    if (!own(error, ['code', 'stage', 'category', 'messageKey', 'actionCode', 'retryable', 'recovery', 'retryAfterSeconds'])
      || typeof error.code !== 'string' || !Object.hasOwn(catalog, error.code)) return null;
    const entry = catalog[error.code];
    if (entry.httpStatus !== httpStatus || !['stage', 'category', 'messageKey', 'actionCode', 'retryable', 'recovery']
      .every(key => error[key] === entry[key])) return null;
    const delay = error.retryAfterSeconds;
    if (delay !== null && (!delayCodes.has(error.code) || !Number.isSafeInteger(delay)
      || delay < 1 || delay > maxRetrySeconds)) return null;
    return { code: error.code, requestId: data.requestId, retryAfterSeconds: delay };
  } catch { return null; }
}

/** Diagnostic is reconstructed from the local catalog, including in verbose mode. */
export function errorDiagnostic(bytes, { contentType, httpStatus, lang = 'fr' } = {}) {
  const decoded = decode(bytes, contentType, httpStatus);
  const code = decoded?.code ?? 'TRANSPORT_FAILED';
  const entry = catalog[code];
  const locale = lang === 'en' ? 'en' : 'fr';
  return Object.freeze({ outcome: 'CONTROL_FAILED', protocolValid: decoded !== null, code,
    stage: entry.stage, category: entry.category, actionCode: entry.actionCode,
    message: entry[locale].message, action: entry[locale].action,
    documentationPath: `${locale === 'en' ? '/en' : ''}/docs/errors#${code.toLowerCase().replaceAll('_', '-')}`,
    requestId: decoded?.requestId ?? null,
    retryable: decoded !== null && entry.retryable,
    recovery: decoded === null ? 'NONE' : entry.recovery,
    retryAfterSeconds: decoded?.retryAfterSeconds ?? null });
}

/** Pure decision, no timers, HTTP, audit, ledger or Git mutation. POSTs are never replayed here. */
export function recoveryDecision(diagnostic, { operation, attempt, maxAttempts, remainingMs,
  jitter = Math.random() } = {}) {
  const stop = Object.freeze({ action: 'STOP', delayMs: 0 });
  if (!diagnostic?.protocolValid || !diagnostic.retryable
    || !['READ', 'ADMISSION', 'PUBLICATION'].includes(operation)
    || !Number.isSafeInteger(attempt) || attempt < 1
    || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || attempt >= maxAttempts
    || !Number.isSafeInteger(remainingMs) || remainingMs < 1
    || !Number.isFinite(jitter) || jitter < 0 || jitter > 1) return stop;
  const backoff = Math.ceil(Math.min(30000, 500 * 2 ** Math.min(attempt - 1, 20)) * (0.5 + jitter / 2));
  const delayMs = Math.max(backoff, (diagnostic.retryAfterSeconds ?? 0) * 1000);
  if (!Number.isSafeInteger(delayMs) || delayMs >= remainingMs) return stop;
  const action = operation === 'ADMISSION' ? 'RECOVER_ADMISSION'
    : operation === 'PUBLICATION' ? 'RECONCILE_PUBLICATION' : 'RETRY_READ';
  return Object.freeze({ action, delayMs });
}
