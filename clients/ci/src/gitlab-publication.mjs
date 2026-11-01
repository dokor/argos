import { publicationConfiguration, fingerprint, PUBLIC_ISSUE } from './publication-policy.mjs';
import { Failure, requireValue } from './diagnostics.mjs';
import { PublicationRejected } from './publication-sync.mjs';
import { readJson } from './transport.mjs';
import { timestamp, digest } from './contracts.mjs';
import { VERSION, errors } from './resources.mjs';

const origin = 'https://gitlab.com', positive = v => Number.isSafeInteger(v) && v > 0;
function context(config, env) {
  const d = publicationConfiguration(config).destination;
  requireValue(d?.provider === 'gitlab' && d.origin === origin && d.id === env.CI_PROJECT_ID && d.repository === env.CI_PROJECT_PATH
    && env.GITLAB_CI === 'true' && env.CI_SERVER_URL === origin && env.CI_API_V4_URL === origin + '/api/v4'
    && env.CI_COMMIT_REF_PROTECTED === 'true' && env.CI_COMMIT_BRANCH === env.CI_DEFAULT_BRANCH
    && ['push', 'web', 'schedule'].includes(env.CI_PIPELINE_SOURCE) && !env.CI_MERGE_REQUEST_IID && !env.ARGOS_API_KEY, 'CONFIG_INVALID');
  return d;
}
function http(token, { fetcher = fetch, now = Date.now } = {}) {
  requireValue(typeof token === 'string' && /^glpat-[A-Za-z0-9_-]{20,255}$/.test(token), 'PUBLICATION_AUTH_FAILED');
  return async (method, path, body, { signal, text = false } = {}) => {
    requireValue(/^\/api\/v4\/(?:user|users\/[1-9][0-9]*|personal_access_tokens\/self|projects(?:\?[^#]*|\/[1-9][0-9]*(?:[/?][^#]*)?))$/.test(path), 'CONFIG_INVALID');
    const requestSignal = AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(15000)]);
    let response;
    try { response = await fetcher(origin + path, { method, redirect: 'error', cache: 'no-store', signal: requestSignal,
      headers: { Accept: text ? 'text/plain' : 'application/json', 'PRIVATE-TOKEN': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw new Failure('PUBLICATION_STATE_UNKNOWN', { transient: true, ambiguous: method === 'POST' }); }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const rate = response.status === 429, retry = response.headers.get('retry-after');
      const seconds = retry && /^\d{1,7}$/.test(retry) ? Number(retry) : retry ? Math.ceil((Date.parse(retry) - now()) / 1000) : null;
      const code = rate ? 'PUBLICATION_RATE_LIMITED' : response.status === 401 ? 'PUBLICATION_AUTH_FAILED'
        : [403, 404, 410, 451].includes(response.status) ? 'DESTINATION_UNAVAILABLE'
        : [400, 409, 422].includes(response.status) ? 'CONFIG_INVALID' : 'PUBLICATION_STATE_UNKNOWN';
      const options = { transient: rate || response.status >= 500, ambiguous: method === 'POST',
        retryAfterSeconds: Number.isSafeInteger(seconds) && seconds >= 0 ? Math.min(seconds, 2764800) : null };
      if (method === 'POST' && code !== 'PUBLICATION_STATE_UNKNOWN' && response.status < 500) throw new PublicationRejected(code, options);
      throw new Failure(code, options);
    }
    requireValue(response.status === (method === 'POST' ? 201 : 200), 'PUBLICATION_STATE_UNKNOWN');
    if (!text) return { value: await readJson(response, 1024 * 1024, requestSignal), headers: response.headers };
    requireValue(/^text\/plain(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') ?? ''), 'ARTIFACT_INVALID');
    const reader = response.body?.getReader(); requireValue(reader, 'ARTIFACT_INVALID');
    const chunks = []; let size = 0; const cancel = () => { void reader.cancel().catch(() => {}); };
    requestSignal.addEventListener('abort', cancel, { once: true });
    try {
      while (true) { requestSignal.throwIfAborted(); const { value, done } = await reader.read(); requestSignal.throwIfAborted(); if (done) break;
        size += value.byteLength; requireValue(size <= 65536, 'ARTIFACT_INVALID'); chunks.push(Buffer.from(value)); }
      return { value: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), headers: response.headers };
    } finally { requestSignal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); }
  };
}
function nextPage(headers, page, path, rows) {
  const next = headers.get('x-next-page');
  if (next !== null) requireValue(next === '' || next === String(page + 1), 'PUBLICATION_STATE_UNKNOWN');
  const link = headers.get('link'); let linked = null;
  if (link) {
    const parsed = link.split(',').map(s => /^\s*<([^>]+)>;\s*rel="(first|prev|next|last)"\s*$/.exec(s));
    requireValue(parsed.every(Boolean) && new Set(parsed.map(p => p[2])).size === parsed.length, 'PUBLICATION_STATE_UNKNOWN');
    const wanted = new URL(origin + path);
    for (const [, target, rel] of parsed) {
      const url = new URL(target);
      requireValue(url.origin === origin && url.pathname === wanted.pathname && !url.username && !url.password && !url.hash
        && [...url.searchParams.keys()].sort().join(',') === [...wanted.searchParams.keys()].sort().join(',')
        && [...wanted.searchParams].every(([k, v]) => k === 'page' ? /^[1-9][0-9]*$/.test(url.searchParams.get(k)) : url.searchParams.get(k) === v), 'PUBLICATION_STATE_UNKNOWN');
      if (rel === 'next') { requireValue(url.searchParams.get('page') === String(page + 1), 'PUBLICATION_STATE_UNKNOWN'); linked = String(page + 1); }
    }
  }
  requireValue(next === null || linked === null || linked === next, 'PUBLICATION_STATE_UNKNOWN');
  // A full page without any pagination proof is incomplete, never an empty tail.
  requireValue(rows < 100 || next !== null || linked !== null, 'PUBLICATION_STATE_UNKNOWN');
  return linked ?? (next || null);
}

export function gitlabPublication(input, env, dependencies = {}, readOnly = false) {
  const config = publicationConfiguration(input), d = context(config, env), now = dependencies.now ?? Date.now;
  const request = http(readOnly ? env.ARGOS_GITLAB_READ_TOKEN : env.ARGOS_GITLAB_PUBLISH_TOKEN, dependencies);
  const root = '/api/v4/projects/' + d.id, kind = env.ARGOS_GITLAB_CREDENTIAL_KIND ?? 'project-token';
  requireValue(['project-token', 'dedicated-user'].includes(kind), 'CONFIG_INVALID');
  async function readProject(options) {
    const { value } = await request('GET', root, null, options);
    requireValue(String(value.id) === d.id && value.path_with_namespace === d.repository && value.visibility === d.visibility
      && value.archived === false && !value.forked_from_project && ['enabled', 'private'].includes(value.issues_access_level)
      && value.default_branch === env.CI_DEFAULT_BRANCH && value.keep_latest_artifact === false, 'DESTINATION_UNAVAILABLE');
    return value;
  }
  async function identity(options) {
    const user = (await request('GET', '/api/v4/user', null, options)).value;
    const token = (await request('GET', '/api/v4/personal_access_tokens/self', null, options)).value;
    requireValue(positive(user.id) && user.state === 'active' && user.locked === false && user.is_admin !== true
      && positive(token.id) && token.user_id === user.id && token.active === true && token.revoked === false
      && typeof token.expires_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(token.expires_at)
      && Date.parse(token.expires_at + 'T00:00:00Z') > now() && Array.isArray(token.scopes)
      && token.scopes.length === 1 && token.scopes[0] === (readOnly ? 'read_api' : 'api'), 'PUBLICATION_AUTH_FAILED');
    if (!readOnly) {
      requireValue(String(user.id) === d.botId && (kind === 'project-token'
        ? user.bot === true && new RegExp(`^project_${d.id}_bot_[a-zA-Z0-9]+$`).test(user.username)
        : user.bot === false), 'PUBLICATION_AUTH_FAILED');
      const member = (await request('GET', `${root}/members/all/${user.id}`, null, options)).value;
      requireValue(member.id === user.id && [15, 20].includes(member.access_level)
        && (member.expires_at === null || /^\d{4}-\d{2}-\d{2}$/.test(member.expires_at)
          && Date.parse(member.expires_at + 'T00:00:00Z') > now()), 'PUBLICATION_AUTH_FAILED');
      if (kind === 'dedicated-user') {
        const { value, headers } = await request('GET', '/api/v4/projects?membership=true&simple=true&per_page=100&page=1', null, options);
        requireValue(Array.isArray(value) && value.length === 1 && String(value[0].id) === d.id
          && nextPage(headers, 1, '/api/v4/projects?membership=true&simple=true&per_page=100&page=1', value.length) === null, 'PUBLICATION_AUTH_FAILED');
      }
    }
    return user;
  }
  async function readDestination(options) {
    await readProject(options); await identity(options);
    if (readOnly) {
      const actor = (await request('GET', '/api/v4/users/' + d.botId, null, options)).value;
      const member = (await request('GET', `${root}/members/all/${d.botId}`, null, options)).value;
      requireValue(String(actor.id) === d.botId && actor.state === 'active' && (kind === 'dedicated-user' ? actor.bot === false
        : actor.bot === true && new RegExp(`^project_${d.id}_bot_[a-zA-Z0-9]+$`).test(actor.username))
        && String(member.id) === d.botId && [15, 20].includes(member.access_level), 'PUBLICATION_AUTH_FAILED');
    }
    return { ...d, botVerified: true, issuesEnabled: true, conditionalReopen: false };
  }
  function normalize(row) {
    requireValue(row && positive(row.id) && positive(row.iid) && String(row.project_id) === d.id && row.issue_type === 'issue'
      && ['opened', 'closed'].includes(row.state) && timestamp(row.created_at) && timestamp(row.updated_at)
      && positive(row.author?.id) && typeof row.author.username === 'string' && typeof row.confidential === 'boolean'
      && typeof row.description === 'string' && Buffer.byteLength(row.description) <= 65536
      && Array.isArray(row.labels) && row.labels.every(l => typeof l === 'string' && l.length <= 255)
      && !row.moved_to_id && !row.promoted_to_epic_id
      && (d.visibility !== 'private' || String(row.author.id) !== d.botId || !row.description.includes('<!-- argos-ci-issue-v1:') || row.confidential), 'PUBLICATION_STATE_UNKNOWN');
    const held = row.state === 'closed' || row.labels.some(l => /^argos:(?:ignore|false-positive|accepted-risk)(?:$|:)/i.test(l));
    // isBot denotes the authenticated automation identity; dedicated-user is a separate explicit opt-in.
    const isBot = String(row.author.id) === d.botId && (kind === 'dedicated-user'
      || new RegExp(`^project_${d.id}_bot_[a-zA-Z0-9]+$`).test(row.author.username));
    return { id: String(row.iid), destinationId: d.id, authorId: String(row.author.id), isBot, kind: 'issue',
      state: row.state === 'opened' ? 'open' : 'closed', body: row.description,
      revision: fingerprint([row.id, row.updated_at, row.state, row.description, row.labels, row.confidential]), createdAt: row.created_at,
      decision: { kind: held ? 'UNKNOWN' : 'NONE', authorized: false, actorId: null, at: null, until: null,
        version: fingerprint([row.updated_at, row.state, row.labels, row.confidential]) } };
  }
  async function listIssues(cursor, options) {
    requireValue(cursor === null || /^[1-9][0-9]*$/.test(cursor), 'PUBLICATION_STATE_UNKNOWN');
    const page = cursor === null ? 1 : Number(cursor); requireValue(page <= 20 && Number.isSafeInteger(page), 'PUBLICATION_STATE_UNKNOWN');
    const path = root + `/issues?state=all&scope=all&order_by=created_at&sort=asc&per_page=100&page=${page}`;
    const { value, headers } = await request('GET', path, null, options);
    requireValue(Array.isArray(value) && value.length <= 100, 'PUBLICATION_STATE_UNKNOWN');
    const nextCursor = nextPage(headers, page, path, value.length);
    return { items: value.map(normalize), nextCursor, complete: nextCursor === null };
  }
  async function readIssue(id, options) {
    requireValue(/^[1-9][0-9]{0,19}$/.test(id), 'CONFIG_INVALID');
    return normalize((await request('GET', root + '/issues/' + id, null, options)).value);
  }
  async function createIssue(payload, options) {
    requireValue(!readOnly && (d.visibility !== 'public' || payload.title === PUBLIC_ISSUE.title && payload.body === PUBLIC_ISSUE.body
      && payload.labels.length === 0), 'CONFIG_INVALID');
    return normalize((await request('POST', root + '/issues', { title: payload.title, description: payload.body,
      labels: payload.labels.join(','), confidential: d.visibility === 'private', issue_type: 'issue' }, options)).value);
  }
  async function sourceProof(options) {
    requireValue(readOnly && /^[1-9][0-9]{0,19}$/.test(env.CI_PIPELINE_ID ?? ''), 'CONFIG_INVALID');
    await readProject(options); await identity(options);
    const jobs = [], ids = new Set(); let page = 1;
    while (true) {
      requireValue(page <= 20, 'ARTIFACT_INVALID');
      const path = `${root}/pipelines/${env.CI_PIPELINE_ID}/jobs?include_retried=false&per_page=100&page=${page}`;
      const { value, headers } = await request('GET', path, null, options);
      requireValue(Array.isArray(value) && value.length <= 100, 'ARTIFACT_INVALID');
      for (const job of value) { requireValue(positive(job.id) && !ids.has(job.id), 'ARTIFACT_INVALID'); ids.add(job.id); jobs.push(job); }
      const next = nextPage(headers, page, path, value.length); if (!next) break; page = Number(next);
    }
    const matches = jobs.filter(j => j.name === 'argos_control'); requireValue(matches.length === 1, 'ARTIFACT_INVALID');
    const source = matches[0], { value: job } = await request('GET', root + '/jobs/' + source.id, null, options);
    const valid = j => j.id === source.id && j.name === 'argos_control' && ['success', 'failed'].includes(j.status)
      && String(j.pipeline?.id) === env.CI_PIPELINE_ID && String(j.pipeline?.project_id) === d.id && j.pipeline?.sha === env.CI_COMMIT_SHA
      && j.commit?.id === env.CI_COMMIT_SHA && j.ref === env.CI_DEFAULT_BRANCH && j.erased_at === null && timestamp(j.finished_at)
      && Date.parse(j.finished_at) <= now();
    requireValue(valid(source) && valid(job), 'ARTIFACT_INVALID');
    const { value: trace } = await request('GET', root + '/jobs/' + job.id + '/trace', null, { ...options, text: true });
    const rows = trace.split(/\r?\n/).flatMap(line => { try { const row = JSON.parse(line); return row?.clientVersion === VERSION ? [row] : []; } catch { return []; } });
    const controls = rows.filter(r => ['audit', 'resume'].includes(r.command)); requireValue(controls.length === 1, 'ARTIFACT_INVALID');
    const control = controls[0];
    if (control.auditOutcome === 'CONTROL_FAILED') {
      requireValue(control.auditExitCode === 2 && control.exitCode === 2, 'ARTIFACT_INVALID');
      return { controlFailed: true, code: Object.hasOwn(errors, control.diagnostic?.code ?? '') ? control.diagnostic.code : 'TRANSPORT_FAILED' };
    }
    const seals = rows.filter(r => r.command === 'publication-stage');
    requireValue(['GO', 'SITE_NO_GO'].includes(control.auditOutcome) && control.auditExitCode === (control.auditOutcome === 'GO' ? 0 : 1)
      && control.exitCode === control.auditExitCode && digest(control.evidenceSha256) && seals.length === 1
      && seals[0].proofStaged === true && digest(seals[0].cipherSha256) && seals[0].auditOutcome === control.auditOutcome
      && seals[0].auditExitCode === control.auditExitCode && seals[0].exitCode === control.exitCode
      && timestamp(job.artifacts_expire_at) && Date.parse(job.artifacts_expire_at) > now()
      && Date.parse(job.artifacts_expire_at) <= now() + 7 * 86400000, 'ARTIFACT_INVALID');
    return { digest: control.evidenceSha256, cipherDigest: seals[0].cipherSha256, producerId: String(job.id),
      invocation: `${env.CI_PIPELINE_ID}:1`, auditOutcome: control.auditOutcome };
  }
  return { readProject, verifyStage: async options => { requireValue(readOnly, 'CONFIG_INVALID'); await readProject(options); await identity(options); },
    readDestination, listIssues, readIssue, createIssue, sourceProof };
}
