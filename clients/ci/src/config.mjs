import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { requireValue } from './diagnostics.mjs';
import { targetUrl, uuid } from './contracts.mjs';

export function configuration(env, command) {
  requireValue(!env.NODE_OPTIONS && (!env.NODE_TLS_REJECT_UNAUTHORIZED || env.NODE_TLS_REJECT_UNAUTHORIZED === '1'));
  const lang = env.ARGOS_LANG ?? 'fr'; requireValue(['fr', 'en'].includes(lang));
  const provider = env.GITHUB_ACTIONS === 'true' ? 'github' : env.GITLAB_CI === 'true' ? 'gitlab' : 'local';
  const repository = provider === 'github' ? env.GITHUB_REPOSITORY : provider === 'gitlab' ? env.CI_PROJECT_PATH : env.ARGOS_REPOSITORY;
  const sha = provider === 'github' ? env.GITHUB_SHA : provider === 'gitlab' ? env.CI_COMMIT_SHA : env.ARGOS_SHA;
  const invocation = provider === 'github' ? `${env.GITHUB_RUN_ID}:${env.GITHUB_RUN_ATTEMPT}`
    : provider === 'gitlab' ? `${env.CI_PIPELINE_ID}:1` : env.ARGOS_INVOCATION;
  const producerId = provider === 'github' ? env.GITHUB_JOB : provider === 'gitlab' ? env.CI_JOB_ID : env.ARGOS_PRODUCER_ID;
  const environment = env.ARGOS_ENVIRONMENT ?? 'production';
  requireValue(typeof repository === 'string' && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+){1,15}$/.test(repository) && repository.length <= 256
    && typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha) && /^[1-9][0-9]{0,19}:[1-9][0-9]{0,5}$/.test(invocation)
    && typeof producerId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(producerId)
    && ['production', 'staging', 'preview'].includes(environment));
  if (provider === 'github') requireValue(['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)
    && env.GITHUB_REF === `refs/heads/${env.ARGOS_DEFAULT_BRANCH ?? 'main'}`);
  if (provider === 'gitlab') requireValue(['push', 'web', 'schedule'].includes(env.CI_PIPELINE_SOURCE)
    && env.CI_COMMIT_REF_PROTECTED === 'true' && env.CI_COMMIT_BRANCH === env.CI_DEFAULT_BRANCH
    && env.CI_SERVER_URL === 'https://gitlab.com');
  const samples = Number(env.ARGOS_SAMPLES ?? '2'); requireValue([1, 2].includes(samples));
  const timeout = Number(env.ARGOS_TIMEOUT_SECONDS ?? '1200'); requireValue(Number.isSafeInteger(timeout) && timeout >= 1 && timeout <= 3600);
  const target = env.ARGOS_TARGET_URL;
  if (['audit', 'doctor', 'resume', 'export'].includes(command)) requireValue(targetUrl(target), 'TARGET_REJECTED');
  const key = env.ARGOS_API_KEY;
  if (['audit', 'doctor', 'resume', 'export'].includes(command)) requireValue(!env.ARGOS_GITLAB_PUBLISH_TOKEN, 'CONFIG_INVALID');
  if (['audit', 'doctor', 'resume', 'export'].includes(command)) requireValue(typeof key === 'string' && /^argos_ci_[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/.test(key), 'AUTHENTICATION_FAILED');
  // Rerunning the same workflow/job keeps the intention; changed input conflicts on the server.
  const bytes = createHash('sha256').update(JSON.stringify(['argos-ci-v1', provider, repository, invocation.split(':')[0]])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex'), derived = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const intent = env.ARGOS_IDEMPOTENCY_KEY ?? derived; requireValue(uuid(intent));
  requireValue(!env.ARGOS_EXPORT_PRIVATE || env.ARGOS_EXPORT_PRIVATE === '1');
  return { lang, key, target, samples, timeout, intent, exportPrivate: env.ARGOS_EXPORT_PRIVATE === '1',
    output: resolve(env.ARGOS_OUTPUT_DIR ?? '.argos-ci'), provenance: { provider, repository, sha, invocation, producerId, environment } };
}
