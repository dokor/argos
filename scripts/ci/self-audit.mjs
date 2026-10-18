import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { trustedEndpoint, boundedJson } from './trusted-http.mjs';
import { SITE, POLICY, SERVICES, SHA, ControlError, requireControl, normalizeServices, parseServices, analysisKey, evaluateReports, collectionEvidence } from './self-audit-policy.mjs';

const IMAGE = /^sha256:[a-f0-9]{64}$/;
const ID = /^[a-f0-9]{64}$/;
const dockerCommand = args => execFileSync('docker', args, {
  encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});

export function deploymentSnapshot(expectedSha, service, docker = dockerCommand) {
  const selected = normalizeServices(service);
  requireControl(SHA.test(expectedSha), 'configuration-invalid');
  try {
    return SERVICES.map(name => {
      const [container] = JSON.parse(docker(['container', 'inspect', name]));
      requireControl(ID.test(container.Id) && IMAGE.test(container.Image)
        && container.State?.Status === 'running' && container.State.OOMKilled === false
        && [undefined, 'healthy'].includes(container.State.Health?.Status)
        && Number.isSafeInteger(container.RestartCount) && container.RestartCount >= 0
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(container.State.StartedAt), 'runtime-unhealthy');
      const [image] = JSON.parse(docker(['image', 'inspect', container.Image]));
      const revision = image.Config?.Labels?.['org.opencontainers.image.revision'];
      requireControl(image.Id === container.Image && SHA.test(revision)
        && (!selected.includes(name) || revision === expectedSha), 'revision-unverified');
      return { service: name, containerId: container.Id, imageId: container.Image, revision,
        startedAt: container.State.StartedAt, restartCount: container.RestartCount };
    });
  } catch (error) {
    throw error instanceof ControlError ? error : new ControlError('runtime-unavailable');
  }
}

/** Requests stay on the fixed origin. Bound bodies and time, and never expose HTTP errors. */
export function accountClient({ fetcher = fetch, wait = sleep } = {}) {
  const cookies = new Map();
  let csrf;
  async function request(path, { method = 'GET', body, key, retry = method === 'GET' } = {}) {
    const endpoint=trustedEndpoint(SITE,path);
    for (let attempt = 0; attempt < (retry ? 3 : 1); attempt++) {
      let response;const signal=AbortSignal.timeout(10000);
      try {
        response = await fetcher(endpoint, { method, redirect: 'error', signal,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json',
            Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
            ...(method !== 'GET' ? { Origin: SITE, 'X-Argos-CSRF': csrf } : {}),
            ...(key ? { 'Idempotency-Key': key } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}) });
      } catch { if (!retry || attempt === 2) throw new ControlError('transport-failed'); }
      if (!response || response.status === 429 || response.status >= 500) {
        const header = response?.headers.get('retry-after');
        const delay = header ? (/^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now()) : 1000 * 2 ** attempt;
        await response?.body?.cancel();
        requireControl(retry && attempt < 2 && Number.isFinite(delay) && delay >= 0 && delay <= 30000,
          response?.status === 429 ? 'rate-limited' : 'service-unavailable');
        await wait(delay);
        continue;
      }
      requireControl(response.ok, [401, 403].includes(response.status) ? 'authentication-failed' : 'request-rejected');
      for (const cookie of response.headers.getSetCookie()) {
        const match = /^(argos_account(?:_csrf)?)=([^;\s]{0,4096})(?:;|$)/.exec(cookie);
        if (match) cookies.set(match[1], match[2]);
      }
      return boundedJson(response,2*1024*1024,signal);
    }
  }
  return {
    request,
    async login(email, password) {
      const data = await request('/api/account/csrf');
      csrf = data.csrf;
      requireControl(/^[A-Za-z0-9_-]{43}$/.test(csrf) && cookies.get('argos_account_csrf') === csrf, 'authentication-failed');
      const profile = await request('/api/account/auth/login', { method: 'POST', body: { email, password } });
      requireControl(profile.verified === true && Boolean(cookies.get('argos_account')), 'authentication-failed');
    },
    async logout() {
      if (cookies.get('argos_account')) {
        try { await request('/api/account/auth/logout', { method: 'POST', body: {} }); } catch { /* Bounded best effort; session has its normal expiry. */ }
      }
      cookies.clear();
    },
  };
}

export async function collectAudit({ expectedSha, service, services = service, email, password, invocation,
  snapshot = deploymentSnapshot, client = accountClient(), wait = sleep, now = Date.now } = {}) {
  let selected = null;
  try { selected = normalizeServices(services); } catch { /* Invalid input stays out of evidence. */ }
  const evidence = { schemaVersion: 1, policy: POLICY, expectedSha: SHA.test(expectedSha) ? expectedSha : null,
    repository:'dokor/argos',invocation:typeof invocation==='string' && /^[1-9][0-9]{0,19}:[1-9][0-9]{0,5}$/.test(invocation)?invocation:null,
    services: selected, outcome: 'CONTROL_FAILED', findings: [], collection: [] };
  try {
    requireControl(SHA.test(expectedSha) && selected && email && password
      && typeof invocation === 'string' && /^[1-9][0-9]{0,19}:[1-9][0-9]{0,5}$/.test(invocation), 'configuration-invalid');
    // Authenticated usage proves the BFF, Java and database respond. Readiness
    // retries cover restarts; bad credentials and quotas are never bypassed.
    const healthDeadline = now() + 120000;
    let deployment;
    while (true) {
      try { deployment = snapshot(expectedSha, selected); await client.request('/api/account/auth/providers'); break; }
      catch (error) {
        requireControl(now() < healthDeadline, 'health-timeout');
        if (error instanceof ControlError && ['authentication-failed', 'request-rejected', 'rate-limited'].includes(error.code)) throw error;
        await wait(5000);
      }
    }
    evidence.deployment = deployment;
    await client.login(email, password);
    // Admission is authoritative. This read checks authenticated application/DB
    // health without refusing recovery of an already-admitted idempotent run.
    await client.request('/api/account/usage');
    const reports = [];
    for (let sample = 0; sample < 2; sample++) {
      // Recover ambiguous HTTP admission within this attempt. A manually rerun
      // control gets fresh samples, so a terminal failed run cannot trap recovery.
      const key = analysisKey(deployment, sample, invocation);
      const created = await client.request('/api/account/analyses', { method: 'POST', retry: true, key,
        body: { url: SITE + '/', profileId: 'server-default-v1' } });
      requireControl(typeof created.runId === 'string' && /^[1-9][0-9]{0,18}$/.test(created.runId), 'response-invalid');
      const deadline = now() + 240000;
      while (true) {
        const run = await client.request('/api/account/runs/' + created.runId);
        requireControl(!['FAILED', 'CANCELED'].includes(run.status), 'audit-failed');
        if (run.status === 'COMPLETED') {
          const report = await client.request(`/api/account/runs/${created.runId}/report`);
          reports.push(report);
          evidence.collection.push(collectionEvidence(report));
          break;
        }
        requireControl(['QUEUED', 'RUNNING'].includes(run.status), 'response-invalid');
        requireControl(now() < deadline, 'audit-timeout');
        await wait(2000);
      }
    }
    requireControl(JSON.stringify(deployment) === JSON.stringify(snapshot(expectedSha, selected)), 'deployment-changed');
    Object.assign(evidence, evaluateReports(...reports));
  } catch (error) {
    evidence.reason = error instanceof ControlError ? error.code : 'control-failed';
  } finally { await client.logout(); }
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidence = await collectAudit({ expectedSha: process.env.EXPECTED_SHA, services: parseServices(process.env.DEPLOYED_SERVICES),
    email: process.env.ARGOS_CI_EMAIL, password: process.env.ARGOS_CI_PASSWORD,
    invocation: `${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}` });
  try {
    const output = 'outputs/post-deploy-audit.json';
    mkdirSync(dirname(output), { recursive: true });
    const bytes=JSON.stringify(evidence,null,2)+'\n';
    requireControl(Buffer.byteLength(bytes,'utf8')<=65536,'evidence-invalid');
    writeFileSync(output, bytes, { mode: 0o600, flag: 'wx' });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `outcome=${evidence.outcome}\nevidence_sha256=${createHash('sha256').update(bytes).digest('hex')}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `Argos post-deployment audit: **${evidence.outcome}**. Confirmed findings: ${evidence.findings.length}.` +
      (evidence.reason ? ` Control reason: \`${evidence.reason}\`.` : '') + '\n');
    if (process.env.GITHUB_STEP_SUMMARY && evidence.limitations?.includes('runtime-transfer-size-unavailable-after-fetch-abort'))
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        'Collection limitation: runtime transfer size remains unavailable after documented fetch cancellations. Other scored measurements remain available; coverage checks passed.\n');
    console.log(JSON.stringify({ outcome: evidence.outcome, reason: evidence.reason, findings: evidence.findings.length,
      limitations: evidence.limitations ?? [], collection: evidence.collection }));
    process.exitCode = evidence.outcome === 'GO' ? 0 : evidence.outcome === 'SITE_NO_GO' ? 1 : 2;
  } catch { console.error('Control evidence could not be saved.'); process.exitCode = 2; }
}
