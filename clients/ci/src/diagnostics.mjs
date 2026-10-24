import { errors } from './resources.mjs';
export class Failure extends Error {
  constructor(code, { requestId = null, retryAfterSeconds = null, transient = false, ambiguous = false } = {}) {
    super(Object.hasOwn(errors, code) ? code : 'TRANSPORT_FAILED');
    this.code = this.message; this.requestId = requestId; this.retryAfterSeconds = retryAfterSeconds;
    this.transient = transient; this.ambiguous = ambiguous;
  }
}
export function requireValue(value, code = 'CONFIG_INVALID') { if (!value) throw new Failure(code); }
export function diagnostic(failure, lang = 'fr') {
  const code = failure instanceof Failure ? failure.code : 'TRANSPORT_FAILED';
  const entry = errors[code], locale = lang === 'en' ? 'en' : 'fr';
  return { code, stage: entry.stage, actionCode: entry.actionCode, message: entry[locale].message,
    action: entry[locale].action, documentationUrl: `https://argos.lelouet.fr${locale === 'en' ? '/en' : ''}/docs/errors#${code.toLowerCase().replaceAll('_', '-')}`,
    requestId: failure instanceof Failure ? failure.requestId : null };
}
