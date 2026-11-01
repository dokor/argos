import { randomUUID } from 'node:crypto';
import { Failure, requireValue } from './diagnostics.mjs';
import { readJson } from './transport.mjs';
import { exact } from './contracts.mjs';
import { fingerprint } from './publication-policy.mjs';

const limit = 2 * 1024 * 1024;
const revision = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);

/** A customer-owned, private, pre-provisioned block blob. No automatic bootstrap/reset. */
export function azureJournal(secret, destination, { fetcher = fetch, now = Date.now, readOnly = false } = {}) {
  let endpoint;
  try { endpoint = new URL(secret); } catch { throw new Failure('CONFIG_INVALID'); }
  const p = endpoint.searchParams;
  const allowed = ['sv', 'spr', 'st', 'se', 'sr', 'sp', 'sig', 'skoid', 'sktid', 'skt', 'ske', 'sks', 'skv', 'sip'];
  requireValue(endpoint.protocol === 'https:' && /^[a-z0-9]{3,24}\.blob\.core\.windows\.net$/.test(endpoint.hostname)
    && !endpoint.username && !endpoint.password && !endpoint.port && !endpoint.hash && endpoint.href.length <= 4096
    && /^\/[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])\/[A-Za-z0-9._/-]{1,512}$/.test(endpoint.pathname)
    && !endpoint.pathname.slice(1).split('/').some(v => v === '.' || v === '..' || v === '')
    && [...p.keys()].every(k => allowed.includes(k)) && [...p.keys()].length === new Set(p.keys()).size
    && p.get('sr') === 'b' && p.get('sp') === (readOnly ? 'r' : 'rw') && p.get('spr') === 'https'
    && /^\d{4}-\d{2}-\d{2}$/.test(p.get('sv') ?? '') && (p.get('sig')?.length ?? 0) >= 20
    && Number.isFinite(Date.parse(p.get('se')))
    && Date.parse(p.get('se')) <= now() + 366 * 86400000, 'CONFIG_INVALID');
  requireValue(Date.parse(p.get('se')) > now() + 120000, 'PUBLICATION_AUTH_FAILED');
  const lockKey = fingerprint(['argos-issue-destination-v1', destination.provider, destination.origin, destination.id]);
  function validate(envelope) {
    requireValue(exact(envelope, ['version', 'destinationId', 'repository', 'evidenceKey', 'journal']) && envelope.version === 1
      && envelope.destinationId === destination.id && envelope.repository === destination.repository
      && typeof envelope.evidenceKey === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(envelope.evidenceKey)
      && Buffer.from(envelope.evidenceKey, 'base64').length === 32
      && envelope.journal?.destinationId === destination.id && revision(envelope.journal?.revision), 'PUBLICATION_STATE_UNKNOWN');
    return envelope;
  }
  async function request(method, headers, body, signal, action = null) {
    const url = new URL(endpoint);
    if (action) url.searchParams.set('comp', 'lease');
    const limited = AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(10000)]);
    let response;
    try { response = await fetcher(url.href, { method, headers: { 'x-ms-version': '2023-11-03', ...headers },
      ...(body !== null ? { body } : {}), signal: limited, redirect: 'error', cache: 'no-store' }); }
    catch { throw new Failure('PUBLICATION_STATE_UNKNOWN', { transient: true, ambiguous: method === 'PUT' }); }
    if (!response.ok) { await response.body?.cancel().catch(() => {});
      // Missing blob is never an empty journal: restoring a backup is required.
      throw new Failure(response.status === 401 || response.status === 403 ? 'PUBLICATION_AUTH_FAILED' : 'PUBLICATION_STATE_UNKNOWN',
        { transient: [409, 429, 500, 502, 503, 504].includes(response.status), ambiguous: method === 'PUT' }); }
    return { response, signal: limited };
  }
  async function privateStorage(signal) {
    const url = new URL(endpoint); url.search = '';
    let response;
    try { response = await fetcher(url.href, { method: 'HEAD', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(10000)]) }); }
    catch { throw new Failure('PUBLICATION_STATE_UNKNOWN'); }
    await response.body?.cancel().catch(() => {});
    requireValue([401, 403, 404].includes(response.status) && response.headers.get('x-ms-request-id'), 'DESTINATION_UNAVAILABLE');
  }
  async function load(signal) {
    await privateStorage(signal);
    const { response, signal: limited } = await request('GET', {}, null, signal);
    requireValue(response.status === 200 && /^"[^"\r\n]{1,100}"$/.test(response.headers.get('etag') ?? '')
      && response.headers.get('x-ms-blob-type') === 'BlockBlob', 'PUBLICATION_STATE_UNKNOWN');
    let envelope; try { envelope = validate(await readJson(response, limit, limited)); }
    catch { throw new Failure('PUBLICATION_STATE_UNKNOWN'); }
    return { envelope, etag: response.headers.get('etag') };
  }
  async function withLease(key, operation, { signal } = {}) {
    requireValue(!readOnly && key === lockKey, 'CONFIG_INVALID');
    await privateStorage(signal);
    const leaseId = randomUUID();
    const acquired = await request('PUT', { 'x-ms-lease-action': 'acquire', 'x-ms-lease-duration': '60', 'x-ms-proposed-lease-id': leaseId }, null, signal, 'acquire');
    await acquired.response.body?.cancel().catch(() => {});
    requireValue(acquired.response.status === 201 && acquired.response.headers.get('x-ms-lease-id') === leaseId, 'PUBLICATION_STATE_UNKNOWN');
    const fence = Number.parseInt(fingerprint(leaseId).slice(0, 12), 16) + 1;
    let active = true, stored;
    async function assertHeld({ signal: requestSignal = signal } = {}) {
      requireValue(active && !signal?.aborted, 'PUBLICATION_STATE_UNKNOWN');
      await privateStorage(requestSignal);
      const started = now();
      const { response } = await request('PUT', { 'x-ms-lease-action': 'renew', 'x-ms-lease-id': leaseId }, null, requestSignal, 'renew');
      await response.body?.cancel().catch(() => {});
      requireValue(response.status === 200 && response.headers.get('x-ms-lease-id') === leaseId && now() - started < 15000, 'PUBLICATION_STATE_UNKNOWN');
      // The full random UUID is the server-enforced fence. This number is an opaque engine handle.
      return { key, fence, validUntil: new Date(started + 45000).toISOString() };
    }
    async function save(envelope, { signal: requestSignal = signal, lease } = {}) {
      requireValue(active && stored && lease?.key === key && lease.fence === fence, 'PUBLICATION_STATE_UNKNOWN');
      await assertHeld({ signal: requestSignal }); await privateStorage(requestSignal);
      const bytes = JSON.stringify(validate(envelope)); requireValue(Buffer.byteLength(bytes) <= limit, 'PUBLICATION_STATE_UNKNOWN');
      const { response } = await request('PUT', { 'x-ms-blob-type': 'BlockBlob', 'x-ms-lease-id': leaseId,
        'If-Match': stored.etag, 'Content-Type': 'application/json' }, bytes, requestSignal);
      await response.body?.cancel().catch(() => {});
      const etag = response.headers.get('etag');
      requireValue(response.status === 201 && /^"[^"\r\n]{1,100}"$/.test(etag ?? '') && etag !== stored.etag, 'PUBLICATION_STATE_UNKNOWN');
      stored = { envelope: structuredClone(envelope), etag };
    }
    const session = {
      capabilities: { version: 1, durableJournal: true, privateJournal: true, fencedLease: true }, assertHeld,
      loadJournal: async ({ signal: s } = {}) => { stored = await load(s ?? signal); return structuredClone(stored.envelope.journal); },
      saveJournal: async (journal, { expectedRevision, lease, signal: s } = {}) => {
        requireValue(stored?.envelope.journal.revision === expectedRevision && journal.revision === expectedRevision, 'PUBLICATION_STATE_UNKNOWN');
        const revision = randomUUID();
        const envelope = { ...stored.envelope, journal: { ...journal, revision } };
        await save(envelope, { signal: s, lease }); return { revision, committed: true };
      },
    };
    try { return await operation(session); }
    finally {
      active = false;
      // A failed release never authorizes a retry or masks a completed operation. Expiry is bounded.
      try { const { response } = await request('PUT', { 'x-ms-lease-action': 'release', 'x-ms-lease-id': leaseId }, null,
        AbortSignal.timeout(3000), 'release'); await response.body?.cancel().catch(() => {}); } catch {}
    }
  }
  return { lockKey, loadJournal: async ({ signal } = {}) => (await load(signal)).envelope.journal, withDestinationLease: withLease,
    encryptionKey: async ({ signal } = {}) => Buffer.from((await load(signal)).envelope.evidenceKey, 'base64') };
}
