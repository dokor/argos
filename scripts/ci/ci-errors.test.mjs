import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { errorDiagnostic, recoveryDecision, MAX_ERROR_BYTES } from './ci-errors.mjs';

const catalog = JSON.parse(readFileSync(new URL('../../apps/api-backend/src/main/resources/ci/error-catalog-v1.json', import.meta.url))).errors;
const requestId = '69b1ce84-2761-4973-84f3-21e272583d81';
function envelope(code = 'AUTHENTICATION_FAILED', retryAfterSeconds = null) {
  const { stage, category, messageKey, actionCode, retryable, recovery } = catalog[code];
  return { schemaVersion: 1, requestId, error: { code, stage, category, messageKey, actionCode, retryable, recovery, retryAfterSeconds } };
}
const read = (data, status = 401, lang = 'fr') => errorDiagnostic(JSON.stringify(data),
  { contentType: 'application/json; charset=UTF-8', httpStatus: status, lang });

test('all error families have localized controlled diagnostics and fail the control', () => {
  for (const [code, entry] of Object.entries(catalog)) for (const lang of ['fr', 'en']) {
    const diagnostic = read(envelope(code), entry.httpStatus, lang);
    assert.equal(diagnostic.protocolValid, true, code);
    assert.equal(diagnostic.outcome, 'CONTROL_FAILED');
    assert.equal(diagnostic.message, entry[lang].message);
    assert.match(diagnostic.documentationPath, /^\/(en\/)?docs\/errors#[a-z-]+$/);
    assert.equal(diagnostic.requestId, requestId);
  }
});

test('bad schemas, metadata, upstream text, injections and secrets are never rendered', () => {
  const secret = 'synthetic-SECRET\r\n::error::@everyone\u001b[31m[click](https://evil.invalid)';
  const cases = [null, [], {}, { ...envelope(), schemaVersion: 2 }, { ...envelope(), requestId: secret },
    { ...envelope(), raw: secret }, { ...envelope(), error: { ...envelope().error, code: secret } },
    { ...envelope(), error: { ...envelope().error, messageKey: secret } },
    { ...envelope(), error: { ...envelope().error, actionCode: secret } },
    { ...envelope(), error: { ...envelope().error, stage: 'PUBLICATION' } },
    { ...envelope(), error: { ...envelope().error, message: secret } },
    { ...envelope(), error: { ...envelope().error, retryAfterSeconds: 1 } }];
  for (const data of cases) {
    const diagnostic = read(data);
    assert.equal(diagnostic.protocolValid, false);
    assert.equal(diagnostic.retryable, false);
    assert.equal(diagnostic.requestId, null);
    assert.equal(diagnostic.outcome, 'CONTROL_FAILED');
    assert.ok(!JSON.stringify(diagnostic).includes('synthetic-SECRET'));
    assert.doesNotMatch(JSON.stringify(diagnostic), /::error|@everyone|evil\.invalid/);
  }
  assert.equal(read(envelope(), 403).protocolValid, false);
});

test('invalid UTF-8, oversized content, HTML and invalid JSON fail closed', () => {
  for (const bytes of [new Uint8Array([0xff]), 'x'.repeat(MAX_ERROR_BYTES + 1), '<html>secret</html>', '{'])
    assert.equal(errorDiagnostic(bytes, { contentType: 'application/json', httpStatus: 401 }).protocolValid, false);
  assert.equal(errorDiagnostic(JSON.stringify(envelope()), { contentType: 'text/html', httpStatus: 401 }).protocolValid, false);
});

test('retry delays are bounded and permanent errors never retry', () => {
  for (const invalid of [-1, 0, 1.5, 2764801, '30'])
    assert.equal(read(envelope('RATE_LIMITED', invalid), 429).protocolValid, false);
  const options = { operation: 'READ', attempt: 1, maxAttempts: 3, remainingMs: 5000, jitter: 0 };
  assert.deepEqual(recoveryDecision(read(envelope('QUOTA_EXCEEDED', 30), 429), options), { action: 'STOP', delayMs: 0 });
  const rate = read(envelope('RATE_LIMITED', 30), 429);
  assert.deepEqual(recoveryDecision(rate, options), { action: 'STOP', delayMs: 0 });
  assert.deepEqual(recoveryDecision(rate, { ...options, remainingMs: 60000 }), { action: 'RETRY_READ', delayMs: 30000 });
  assert.deepEqual(recoveryDecision(rate, { ...options, remainingMs: 60000, attempt: 3 }), { action: 'STOP', delayMs: 0 });
});

test('ambiguous admissions and publications reconcile without replaying writes or an audit', () => {
  const options = { attempt: 1, maxAttempts: 3, remainingMs: 10000, jitter: 0 };
  const admission = read(envelope('TRANSPORT_FAILED'), 502);
  assert.deepEqual(recoveryDecision(admission, { ...options, operation: 'ADMISSION' }), { action: 'RECOVER_ADMISSION', delayMs: 250 });
  const publication = read(envelope('PUBLICATION_STATE_UNKNOWN'), 502);
  assert.deepEqual(recoveryDecision(publication, { ...options, operation: 'PUBLICATION' }), { action: 'RECONCILE_PUBLICATION', delayMs: 250 });
  assert.deepEqual(recoveryDecision(publication, { ...options, operation: 'NEW_AUDIT' }), { action: 'STOP', delayMs: 0 });
  const invalid = errorDiagnostic('invalid', { contentType: 'application/json', httpStatus: 502 });
  assert.deepEqual(recoveryDecision(invalid, { ...options, operation: 'ADMISSION' }), { action: 'STOP', delayMs: 0 });
});
