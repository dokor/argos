import { readJson } from './transport.mjs';
import { requireValue, Failure } from './diagnostics.mjs';
import { digest } from './contracts.mjs';
import { VERSION, errors } from './resources.mjs';

/** Provider credentials never accompany an Argos request. Fixed public SaaS origins only. */
export async function providerProof(config, env, { fetcher, signal }, proof = false) {
  const github = config.provenance.provider === 'github';
  requireValue(github || config.provenance.provider === 'gitlab');
  const token = github ? env.ARGOS_GITHUB_READ_TOKEN : env.ARGOS_GITLAB_READ_TOKEN;
  requireValue(typeof token === 'string' && /^[A-Za-z0-9_.-]{10,255}$/.test(token), 'PUBLICATION_AUTH_FAILED');
  const origin = github ? 'https://api.github.com' : 'https://gitlab.com';
  const headers = github ? { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' }
    : { Accept: 'application/json', 'PRIVATE-TOKEN': token };
  async function get(path, text = false) {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
    let response;
    try { response = await fetcher(origin + path, { headers, redirect: 'error', signal: requestSignal, cache: 'no-store' }); }
    catch { throw new Failure('PUBLICATION_STATE_UNKNOWN'); }
    if (response.status !== 200) { await response.body?.cancel(); throw new Failure(response.status === 401 || response.status === 403 ? 'PUBLICATION_AUTH_FAILED' : 'DESTINATION_UNAVAILABLE'); }
    if (!text) return readJson(response, 262144, requestSignal);
    // Treat the trace as bytes, never terminal/shell instructions. Deadline covers its stream too.
    requireValue(/^text\/plain(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') ?? ''), 'ARTIFACT_INVALID');
    const reader = response.body?.getReader(); requireValue(reader, 'ARTIFACT_INVALID');
    const parts = []; let size = 0;
    const cancel = () => { void reader.cancel().catch(() => {}); };
    requestSignal.addEventListener('abort', cancel, { once: true });
    try {
      while (true) { requestSignal.throwIfAborted(); const { done, value } = await reader.read(); requestSignal.throwIfAborted(); if (done) break;
        size += value.byteLength; requireValue(size <= 65536, 'ARTIFACT_INVALID'); parts.push(Buffer.from(value)); }
      return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts));
    } finally { requestSignal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  if (github) {
    const repo = await get('/repos/' + config.provenance.repository);
    requireValue(repo.full_name === config.provenance.repository && repo.private === true && repo.fork === false, 'DESTINATION_UNAVAILABLE');
    return { privateDestinationVerified: true, retentionDays: 7 };
  }
  requireValue(/^[1-9][0-9]{0,19}$/.test(env.CI_PROJECT_ID ?? '') && /^[1-9][0-9]{0,19}$/.test(env.CI_PIPELINE_ID ?? ''));
  const root = '/api/v4/projects/' + env.CI_PROJECT_ID;
  const project = await get(root);
  requireValue(String(project.id) === env.CI_PROJECT_ID && project.path_with_namespace === config.provenance.repository
    && project.visibility === 'private' && project.keep_latest_artifact === false, 'DESTINATION_UNAVAILABLE');
  if (!proof) return { privateDestinationVerified: true, retentionDays: 7 };
  const jobs = await get(`${root}/pipelines/${env.CI_PIPELINE_ID}/jobs?include_retried=false&per_page=100`);
  requireValue(Array.isArray(jobs) && jobs.length < 100, 'ARTIFACT_INVALID');
  const matches = jobs.filter(j => j.name === 'argos_control');
  requireValue(matches.length === 1, 'ARTIFACT_INVALID');
  const job = matches[0];
  requireValue(Number.isSafeInteger(job.id) && job.id > 0 && ['success', 'failed'].includes(job.status)
    && job.pipeline?.sha === config.provenance.sha && String(job.pipeline?.id) === env.CI_PIPELINE_ID, 'ARTIFACT_INVALID');
  const trace = await get(`${root}/jobs/${job.id}/trace`, true);
  const proofs = trace.split(/\r?\n/).flatMap(line => {
    try { const row = JSON.parse(line); return row.clientVersion === VERSION && ['audit', 'resume', 'artifact-check'].includes(row.command)
      && (['GO', 'SITE_NO_GO'].includes(row.auditOutcome) && digest(row.evidenceSha256)
        || row.auditOutcome === 'CONTROL_FAILED' && row.auditExitCode === 2 && row.exitCode === 2) ? [row] : []; } catch { return []; }
  });
  requireValue(proofs.length === 1, 'ARTIFACT_INVALID');
  const result = proofs[0];
  if (result.auditOutcome === 'CONTROL_FAILED') return { controlFailed: true,
    code: Object.hasOwn(errors, result.diagnostic?.code ?? '') ? result.diagnostic.code : 'TRANSPORT_FAILED' };
  return { digest: result.evidenceSha256, producerId: String(job.id) };
}
