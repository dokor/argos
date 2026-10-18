import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { configuration } from './config.mjs';
import { VERSION, policy } from './resources.mjs';
import { Failure, requireValue, diagnostic } from './diagnostics.mjs';
import { validResponse } from './contracts.mjs';
import { transport } from './transport.mjs';
import { writePrivate, safeDirectory, readTrusted } from './evidence.mjs';
import { pipelineResult } from '../../../scripts/ci/ci-verdict.mjs';
import { providerProof } from './providers.mjs';

const base = '/api/ci/v1/';
const defaultSleep = (ms, signal) => wait(ms, undefined, { signal });
function validate(kind, value, expected) { requireValue(validResponse(kind, value, expected), 'TRANSPORT_FAILED'); return value; }
async function preflight(api, config, checkNew = true) {
  const data = validate('Preflight', await api.read(base + 'preflight'));
  requireValue(['audits:write', 'results:read', 'usage:read'].every(s => data.scopes.includes(s)), 'PERMISSION_DENIED');
  requireValue(data.targets.some(t => t.origin === new URL(config.target).origin && t.state === 'VERIFIED' && t.authorizedForKey), 'TARGET_VERIFICATION_REQUIRED');
  if (checkNew) { requireValue(data.newAccessAllowed, 'FEATURE_NOT_AVAILABLE'); requireValue(data.usage.available >= config.samples, 'QUOTA_EXCEEDED'); }
}
async function findAdmission(api, config) {
  try { return validate('Admission', await api.read(base + 'admissions/by-key/' + config.intent), config); }
  catch (e) { if (e instanceof Failure && e.code === 'RESOURCE_NOT_AVAILABLE') return null; throw e; }
}
async function admission(api, config, resume, sleep, signal, random) {
  const existing = await findAdmission(api, config);
  if (resume) { requireValue(existing, 'RESOURCE_NOT_AVAILABLE'); return existing; }
  if (!existing) await preflight(api, config);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return validate('Admission', await api.once('POST', base + 'analyses', { url: config.target, samples: config.samples, profileId: 'standard-v1' }, config.intent), config); }
    catch (e) {
      if (!(e instanceof Failure) || (!e.ambiguous && !e.transient)) throw e;
      // Every ambiguous submission is recovered before any same-key replay.
      await findAdmission(api, config);
      // A recovered ID alone does not attest that changed input matches the original.
      // Only a successful same-key POST confirms that fingerprint; resume is explicitly read-only.
      if (!e.transient || attempt >= 3) throw e;
      const delay = Math.max(Math.ceil(500 * 2 ** attempt * (0.5 + random() / 2)), (e.retryAfterSeconds ?? 0) * 1000);
      requireValue(delay < api.remaining(), e.code); await sleep(delay, signal);
    }
  }
}
function prepareOutput(config) {
  try {
  safeDirectory(dirname(config.output));
  if (!fs.existsSync(config.output)) fs.mkdirSync(config.output, { mode: 0o700 });
  safeDirectory(config.output);
  } catch { throw new Failure('ARTIFACT_INVALID'); }
}
export async function execute(command, env, { fetcher = fetch, signal = new AbortController().signal, now = Date.now, sleep = defaultSleep, random = Math.random } = {}) {
  requireValue(['doctor', 'audit', 'resume', 'export', 'publication-preview', 'artifact-check', 'intent'].includes(command));
  requireValue(Number(process.versions.node.split('.')[0]) >= 24, 'CLIENT_VERSION_UNSUPPORTED');
  const config = configuration(env, command);
  const deadline = now() + config.timeout * 1000;
  const globalSignal = AbortSignal.any([signal, AbortSignal.timeout(config.timeout * 1000)]);
  const api = transport({ key: config.key, signal: globalSignal, deadline, now, fetcher, sleep, random });
  if (command === 'intent') return { exitCode: 0, intent: config.intent };
  if (command === 'artifact-check') return { exitCode: 0, ...await providerProof(config, env, { fetcher, signal: globalSignal }) };
  if (command === 'publication-preview') {
    const proof = config.provenance.provider === 'gitlab' ? await providerProof(config, env, { fetcher, signal: globalSignal }, true)
      : { producerId: env.ARGOS_EVIDENCE_PRODUCER, digest: env.ARGOS_EVIDENCE_SHA256 };
    const expected = { ...config.provenance, ...proof, now: now() };
    let evidence;
    try { evidence = readTrusted(join(config.output, 'evidence.json'), expected); } catch { throw new Failure('ARTIFACT_INVALID'); }
    const result = pipelineResult(evidence.verdict, { publication: 'PREVIEW' });
    return { ...result, eligibleFindings: evidence.verdict.confirmedFindings.filter(f => f.ticketEligible).length };
  }
  validate('VerdictPolicy', await api.read(base + 'policies/standard-v1'));
  const identity = validate('Identity', await api.read(base + 'identity'));
  requireValue(['audits:write', 'results:read', 'usage:read'].every(s => identity.scopes.includes(s)), 'PERMISSION_DENIED');
  if (command === 'doctor') {
    await preflight(api, config);
    return { exitCode: 0, status: 'READY', variables: { ARGOS_API_KEY: true, ARGOS_TARGET_URL: true }, policyCompatible: true,
      targetAuthorized: true, analysesRequired: config.samples, reservationCreated: false, deploymentRevisionAttested: false };
  }
  const admitted = command === 'export' ? await findAdmission(api, config) : await admission(api, config, command === 'resume', sleep, globalSignal, random);
  requireValue(admitted, 'RESOURCE_NOT_AVAILABLE');
  if (command === 'export') {
    requireValue(config.exportPrivate, 'CONFIG_INVALID'); prepareOutput(config);
    const id = env.ARGOS_EXPORT_RUN_ID; requireValue(admitted.runs.some(r => r.id === id && r.status === 'COMPLETED'), 'RESOURCE_NOT_AVAILABLE');
    const summary = validate('Report', await api.read(`${base}runs/${id}/report`), id);
    const details = validate('Export', await api.read(`${base}runs/${id}/export`), id);
    requireValue(JSON.stringify(details.summary) === JSON.stringify(summary), 'TRANSPORT_FAILED');
    const sha256 = writePrivate(join(config.output, 'details.json'), { schemaVersion: 1, kind: 'ci-private-export-v1', provenance: config.provenance, export: details });
    return { exitCode: 0, status: 'EXPORTED', evidenceSha256: sha256, deploymentRevisionAttested: false };
  }
  let verdict, polls = 0;
  while (true) {
    verdict = validate('Verdict', await api.read(`${base}admissions/${admitted.id}/verdict`), { id: admitted.id, samples: config.samples });
    if (verdict.outcome !== 'CONTROL_FAILED' || verdict.error.code !== 'WAIT_TIMEOUT') break;
    const delay = Math.ceil((polls++ < 2 ? 5000 : 10000) * (0.9 + random() * 0.1));
    requireValue(delay < api.remaining(), 'WAIT_TIMEOUT'); await sleep(delay, globalSignal);
  }
  if (verdict.outcome === 'CONTROL_FAILED') throw new Failure(verdict.error.code);
  const result = { ...pipelineResult(verdict) };
  if (config.exportPrivate) {
    prepareOutput(config);
    result.evidenceSha256 = writePrivate(join(config.output, 'evidence.json'), { schemaVersion: 1, kind: 'ci-evidence-v1', clientVersion: VERSION,
      provenance: config.provenance, expiresAt: new Date(now() + 7 * 86400000).toISOString(), admissionId: admitted.id, samples: admitted.samples,
      runIds: admitted.runs.map(r => r.id), verdict });
  }
  return { ...result, deploymentRevisionAttested: false };
}

/** One bounded JSON line, entirely reconstructed from known fields. No HTTP/exception/env echo. */
export async function main(args, env, dependencies = {}) {
  const lang = env.ARGOS_LANG === 'en' ? 'en' : 'fr';
  try {
    requireValue(args.length === 1);
    if (args[0] === '--version') return { clientVersion: VERSION, exitCode: 0 };
    if (args[0] === '--help') return { clientVersion: VERSION, exitCode: 0, commands: ['doctor', 'intent', 'audit', 'resume', 'export', 'artifact-check', 'publication-preview'], documentationUrl: 'https://github.com/dokor/argos/tree/main/clients/ci' };
    const result = await execute(args[0], env, dependencies);
    return { clientVersion: VERSION, command: args[0], ...result };
  } catch (e) {
    const failure = dependencies.signal?.aborted || ['AbortError', 'TimeoutError'].includes(e?.name) ? new Failure('WAIT_TIMEOUT') : e;
    return args[0] === 'publication-preview'
      ? { clientVersion: VERSION, auditOutcome: 'UNKNOWN', auditExitCode: null, publication: 'FAILED', exitCode: 3, diagnostic: diagnostic(failure, lang) }
      : { clientVersion: VERSION, auditOutcome: 'CONTROL_FAILED', auditExitCode: 2, publication: 'DISABLED', exitCode: 2, diagnostic: diagnostic(failure, lang) };
  }
}
