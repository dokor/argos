import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { configuration } from './config.mjs';
import { VERSION, policy } from './resources.mjs';
import { Failure, requireValue, diagnostic } from './diagnostics.mjs';
import { validResponse, timestamp } from './contracts.mjs';
import { transport } from './transport.mjs';
import { writePrivate, safeDirectory, readTrusted } from './evidence.mjs';
import { pipelineResult } from '../../../scripts/ci/ci-verdict.mjs';
import { providerProof } from './providers.mjs';
import { previewConfiguration, publicationConfiguration, selectFindings, fingerprint, FRESHNESS_MS } from './publication-policy.mjs';
import { synchronizeIssues } from './publication-sync.mjs';
import { githubPublication } from './github-publication.mjs';
import { gitlabPublication } from './gitlab-publication.mjs';
import { azureJournal } from './azure-journal.mjs';
import { sealProof, openProof } from './private-transfer.mjs';

const base = '/api/ci/v1/';
const commands = ['doctor', 'audit', 'resume', 'export', 'publication-preview', 'publication-stage', 'publish-github', 'publish-gitlab', 'artifact-check', 'intent'];
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
    try {
      const value = await api.once('POST', base + 'analyses', { url: config.target, samples: config.samples, profileId: 'standard-v1' }, config.intent);
      requireValue(validResponse('Admission', value, config), 'TRANSPORT_FAILED');
      return value;
    }
    catch (e) {
      if (!(e instanceof Failure) || (!e.ambiguous && !e.transient && e.code !== 'TRANSPORT_FAILED')) throw e;
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
async function publicationEvidence(api, admitted, verdict, config, now) {
  const current = validate('Admission', await api.read(`${base}admissions/${admitted.id}`), { id: admitted.id, samples: admitted.samples });
  requireValue(current.runs.every(r => r.status === 'COMPLETED' && timestamp(r.startedAt) && timestamp(r.finishedAt)
    && Date.parse(r.startedAt) <= Date.parse(r.finishedAt) && Date.parse(r.finishedAt) <= now())
    && current.runs.every((r, i) => r.id === admitted.runs[i].id), 'ARTIFACT_INVALID');
  const summaries = [];
  for (const run of current.runs) summaries.push(validate('Report', await api.read(`${base}runs/${run.id}/report`), run.id));
  requireValue(summaries.every(s => timestamp(s.expiresAt) && Date.parse(s.expiresAt) > now()), 'ARTIFACT_INVALID');
  const checked = validate('Verdict', await api.read(`${base}admissions/${admitted.id}/verdict`), { id: admitted.id, samples: admitted.samples });
  requireValue(fingerprint(checked) === fingerprint(verdict), 'ARTIFACT_INVALID');
  const issuedAt = now(), sourceExpiresAt = Math.min(...summaries.map(s => Date.parse(s.expiresAt)));
  return { schemaVersion: 2, kind: 'ci-evidence-v2', clientVersion: VERSION, provenance: config.provenance,
    issuedAt: new Date(issuedAt).toISOString(), observationStartedAt: new Date(Math.min(...current.runs.map(r => Date.parse(r.startedAt)))).toISOString(),
    sourceExpiresAt: new Date(sourceExpiresAt).toISOString(), expiresAt: new Date(Math.min(issuedAt + 7 * 86400000, sourceExpiresAt)).toISOString(),
    admissionId: admitted.id, samples: admitted.samples, runIds: current.runs.map(r => r.id), verdict };
}
export async function execute(command, env, { fetcher = fetch, signal = new AbortController().signal, now = Date.now, sleep = defaultSleep, random = Math.random } = {}) {
  requireValue(commands.includes(command));
  requireValue(Number(process.versions.node.split('.')[0]) >= 24, 'CLIENT_VERSION_UNSUPPORTED');
  const config = configuration(env, command);
  const deadline = now() + config.timeout * 1000;
  const globalSignal = AbortSignal.any([signal, AbortSignal.timeout(config.timeout * 1000)]);
  const api = transport({ key: config.key, signal: globalSignal, deadline, now, fetcher, sleep, random });
  if (['publication-stage', 'publish-github', 'publish-gitlab'].includes(command)) {
    let publication;
    try { requireValue((env.ARGOS_PUBLICATION_CONFIG?.length ?? 0) <= 16384);
      publication = publicationConfiguration(JSON.parse(env.ARGOS_PUBLICATION_CONFIG ?? '{}')); }
    catch { throw new Failure('CONFIG_INVALID'); }
    if (publication.mode === 'DISABLED') return { publication: 'DISABLED', auditOutcome: 'UNKNOWN', auditExitCode: null, exitCode: 0 };
    const github = config.provenance.provider === 'github';
    requireValue(['github', 'gitlab'].includes(config.provenance.provider) && !env.ARGOS_API_KEY && !publication.reopenResolved
      && (command === 'publication-stage' || command === (github ? 'publish-github' : 'publish-gitlab')), 'CONFIG_INVALID');
    let source, sourceReader;
    if (github) {
      const invocation = env.ARGOS_EVIDENCE_INVOCATION ?? config.provenance.invocation, [rootRun, attempt] = invocation.split(':');
      requireValue(/^[1-9][0-9]{0,19}:[1-9][0-9]{0,5}$/.test(invocation) && rootRun === env.GITHUB_RUN_ID
        && Number(attempt) <= Number(env.GITHUB_RUN_ATTEMPT), 'ARTIFACT_INVALID');
      source = { invocation, producerId: env.ARGOS_EVIDENCE_PRODUCER, digest: env.ARGOS_EVIDENCE_SHA256, cipherDigest: env.ARGOS_CIPHER_SHA256 };
      requireValue(source.producerId === 'argos_control', 'ARTIFACT_INVALID');
    } else if (command === 'publication-stage') {
      requireValue(env.CI_JOB_NAME === 'argos_control' && !env.ARGOS_GITLAB_PUBLISH_TOKEN, 'CONFIG_INVALID');
      source = { invocation: config.provenance.invocation, producerId: env.CI_JOB_ID, digest: env.ARGOS_EVIDENCE_SHA256 };
    } else {
      sourceReader = gitlabPublication(publication, env, { fetcher, now }, true);
      source = await sourceReader.sourceProof({ signal: globalSignal });
      if (source.controlFailed) return { auditOutcome: 'CONTROL_FAILED', auditExitCode: 2, publication: 'DISABLED', exitCode: 2,
        diagnostic: diagnostic(new Failure(source.code), config.lang) };
    }
    const expected = { ...config.provenance, invocation: source.invocation, producerId: source.producerId, digest: source.digest, now: now() };
    const readOnly = command === 'publication-stage' || publication.mode === 'PREVIEW';
    const publisher = github ? githubPublication(publication, env, { fetcher, now }) : gitlabPublication(publication, env, { fetcher, now }, readOnly);
    const secret = github ? readOnly ? env.ARGOS_GITHUB_JOURNAL_READ_SAS_URL : env.ARGOS_GITHUB_JOURNAL_SAS_URL
      : readOnly ? env.ARGOS_GITLAB_JOURNAL_READ_SAS_URL : env.ARGOS_GITLAB_JOURNAL_SAS_URL;
    const store = azureJournal(secret,
      publication.destination, { fetcher, now, readOnly });
    const options = { signal: globalSignal };
    let evidence;
    if (command === 'publication-stage') {
      evidence = readTrusted(join(config.output, 'evidence.json'), expected);
      try {
        if (github) await publisher.readDestination(options); else await publisher.verifyStage(options);
        requireValue(now() - Date.parse(evidence.issuedAt) <= FRESHNESS_MS, 'ARTIFACT_INVALID');
        const key = await store.encryptionKey(options); let cipherSha256;
        try { cipherSha256 = sealProof(evidence, expected, publication, key, join(config.output, 'evidence.enc.json')); }
        finally { key.fill(0); }
        return { ...pipelineResult(evidence.verdict, { publication: 'DISABLED' }), proofStaged: true, cipherSha256 };
      } catch (error) { return { ...pipelineResult(evidence.verdict, { publication: 'FAILED' }), proofStaged: false, diagnostic: diagnostic(error, config.lang) }; }
    }
    const key = await store.encryptionKey(options);
    try { evidence = openProof(join(config.output, 'evidence.enc.json'), source.cipherDigest, expected, publication, key, now()); }
    finally { key.fill(0); }
    requireValue(!source.auditOutcome || source.auditOutcome === evidence.verdict.outcome, 'ARTIFACT_INVALID');
    // Exact digest and producer are supplied outside the private store, by the current control job.
    prepareOutput(config); const path = join(config.output, 'evidence.json');
    requireValue(writePrivate(path, evidence) === expected.digest, 'ARTIFACT_INVALID');
    const readDestination = async opts => {
      if (sourceReader) requireValue(fingerprint(await sourceReader.sourceProof(opts)) === fingerprint(source), 'ARTIFACT_INVALID');
      return publisher.readDestination(opts);
    };
    const adapter = { ...publisher, readDestination, loadJournal: store.loadJournal,
      withDestinationLease: (key, operation, opts) => store.withDestinationLease(key, session => operation({ ...publisher, ...session, readDestination,
        createIssue: async (payload, mutationOptions) => {
          await session.assertHeld(mutationOptions);
          return publisher.createIssue(payload, mutationOptions);
        } }), opts) };
    try { return await synchronizeIssues({ evidencePath: path, expected, auditVerdict: evidence.verdict, config: publication,
      adapter, signal: globalSignal, now, sleep, random, lang: config.lang, timeoutMs: Math.min(config.timeout * 1000, 120000) }); }
    finally { fs.unlinkSync(path); }
  }
  if (command === 'intent') return { exitCode: 0, intent: config.intent };
  if (command === 'artifact-check') return { exitCode: 0, ...await providerProof(config, env, { fetcher, signal: globalSignal }) };
  if (command === 'publication-preview') {
    const proof = config.provenance.provider === 'gitlab' ? await providerProof(config, env, { fetcher, signal: globalSignal }, true)
      : { producerId: env.ARGOS_EVIDENCE_PRODUCER, digest: env.ARGOS_EVIDENCE_SHA256 };
    if (proof.controlFailed) return { auditOutcome: 'CONTROL_FAILED', auditExitCode: 2, publication: 'DISABLED', exitCode: 2,
      diagnostic: diagnostic(new Failure(proof.code), config.lang) };
    const expected = { ...config.provenance, ...proof, now: now() };
    let evidence;
    try { evidence = readTrusted(join(config.output, 'evidence.json'), expected); } catch { throw new Failure('ARTIFACT_INVALID'); }
    try {
      requireValue(now() - Date.parse(evidence.issuedAt) <= FRESHNESS_MS, 'ARTIFACT_INVALID');
      const publication = previewConfiguration(env);
      return { ...pipelineResult(evidence.verdict, { publication: 'PREVIEW' }), eligibleFindings: selectFindings(evidence, publication).length,
        newIssueLimit: publication.maxNewIssues, publicationPolicyVersion: 1 };
    } catch (e) { return { ...pipelineResult(evidence.verdict, { publication: 'FAILED' }), diagnostic: diagnostic(e, config.lang) }; }
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
    result.evidenceSha256 = writePrivate(join(config.output, 'evidence.json'), await publicationEvidence(api, admitted, verdict, config, now));
  }
  return { ...result, deploymentRevisionAttested: false };
}

/** One bounded JSON line, entirely reconstructed from known fields. No HTTP/exception/env echo. */
export async function main(args, env, dependencies = {}) {
  const lang = env.ARGOS_LANG === 'en' ? 'en' : 'fr';
  try {
    requireValue(args.length === 1);
    if (args[0] === '--version') return { clientVersion: VERSION, exitCode: 0 };
    if (args[0] === '--help') return { clientVersion: VERSION, exitCode: 0, commands, documentationUrl: 'https://github.com/dokor/argos/tree/main/clients/ci' };
    const result = await execute(args[0], env, dependencies);
    return { clientVersion: VERSION, command: args[0], ...result };
  } catch (e) {
    const failure = dependencies.signal?.aborted || ['AbortError', 'TimeoutError'].includes(e?.name) ? new Failure('WAIT_TIMEOUT') : e;
    const command = commands.includes(args[0]) ? args[0] : 'UNKNOWN';
    return ['publication-preview', 'publication-stage', 'publish-github', 'publish-gitlab'].includes(args[0])
      ? { clientVersion: VERSION, command, auditOutcome: 'UNKNOWN', auditExitCode: null, publication: 'FAILED', exitCode: 3, diagnostic: diagnostic(failure, lang) }
      : { clientVersion: VERSION, command, auditOutcome: 'CONTROL_FAILED', auditExitCode: 2, publication: 'DISABLED', exitCode: 2, diagnostic: diagnostic(failure, lang) };
  }
}
