import { Failure, requireValue } from './diagnostics.mjs';
import { errorDiagnostic, recoveryDecision } from '../../../scripts/ci/ci-errors.mjs';

// Fixed service origin: neither a report, target URL, env var nor artifact can select it.
export const API_ORIGIN = 'https://argos.lelouet.fr';
export async function readJson(response, max, signal) {
  const reader = response.body?.getReader();
  const cancel = () => { void reader?.cancel().catch(() => {}); };
  try {
    requireValue(reader && /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') ?? ''), 'TRANSPORT_FAILED');
    const length = response.headers.get('content-length');
    requireValue(length === null || /^\d+$/.test(length) && Number(length) <= max, 'TRANSPORT_FAILED');
    const parts = []; let size = 0;
    signal.addEventListener('abort', cancel, { once: true });
    while (true) {
      signal.throwIfAborted(); const { value, done } = await reader.read(); signal.throwIfAborted();
      if (done) break;
      size += value.byteLength; requireValue(size <= max, 'TRANSPORT_FAILED'); parts.push(Buffer.from(value));
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts)));
  } catch { throw new Failure('TRANSPORT_FAILED'); }
  finally { signal.removeEventListener('abort', cancel); await reader?.cancel().catch(() => {}); reader?.releaseLock(); }
}
export function transport({ key, signal, fetcher = fetch, sleep, now = Date.now, deadline, random = Math.random }) {
  const remaining = () => Math.max(0, deadline - now());
  async function once(method, path, body, intent) {
    requireValue(/^\/api\/ci\/v1\/(?:preflight|identity|policies\/standard-v1|analyses|admissions\/(?:[a-f0-9-]{36}(?:\/verdict)?|by-key\/[a-f0-9-]{36})|runs\/[1-9][0-9]{0,18}\/(?:report|export))$/.test(path));
    requireValue(remaining() > 0 && !signal.aborted, 'WAIT_TIMEOUT');
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(Math.min(15000, remaining()))]);
    let response;
    try {
      response = await fetcher(API_ORIGIN + path, { method, headers: { Accept: 'application/json', Authorization: `Bearer ${key}`,
        ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': intent } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', cache: 'no-store', signal: requestSignal });
    } catch { throw new Failure(signal.aborted || remaining() <= 0 ? 'WAIT_TIMEOUT' : 'TRANSPORT_FAILED', { transient: true, ambiguous: method === 'POST' }); }
    let value;
    try { value = await readJson(response, response.ok ? 65536 : 4096, requestSignal); }
    catch { throw new Failure(signal.aborted || remaining() <= 0 ? 'WAIT_TIMEOUT' : 'TRANSPORT_FAILED', { ambiguous: method === 'POST' }); }
    if (!response.ok) {
      const decoded = errorDiagnostic(JSON.stringify(value), { httpStatus: response.status, contentType: 'application/json' });
      const header = response.headers.get('retry-after');
      let retryAfterSeconds = decoded.retryAfterSeconds;
      if (header !== null) {
        const seconds = /^\d{1,7}$/.test(header) ? Number(header) : Math.ceil((Date.parse(header) - now()) / 1000);
        requireValue(Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= 2764800, 'TRANSPORT_FAILED');
        retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, seconds);
      }
      throw new Failure(decoded.code, { requestId: decoded.requestId, retryAfterSeconds,
        transient: decoded.protocolValid && decoded.retryable, ambiguous: method === 'POST' && (!decoded.protocolValid || response.status >= 500) });
    }
    requireValue(response.status === 200 || method === 'POST' && response.status === 201, 'TRANSPORT_FAILED');
    return value;
  }
  async function read(path) {
    for (let attempt = 1; ; attempt++) {
      try { return await once('GET', path); }
      catch (e) {
        if (!(e instanceof Failure) || !e.transient) throw e;
        const next = recoveryDecision({ protocolValid: true, retryable: true, retryAfterSeconds: e.retryAfterSeconds },
          { operation: 'READ', attempt, maxAttempts: 3, remainingMs: remaining(), jitter: random() });
        if (next.action === 'STOP') throw e;
        await sleep(next.delayMs, signal);
      }
    }
  }
  return { read, once, remaining };
}
