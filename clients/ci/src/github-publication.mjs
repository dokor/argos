import { fingerprint, publicationConfiguration, PUBLIC_ISSUE } from './publication-policy.mjs';
import { Failure, requireValue } from './diagnostics.mjs';
import { PublicationRejected } from './publication-sync.mjs';
import { readJson } from './transport.mjs';
import { timestamp } from './contracts.mjs';

const origin = 'https://api.github.com';
const positive = v => Number.isSafeInteger(v) && v > 0;
const identityQuery = 'query ArgosPublisherIdentity { viewer { login databaseId __typename } }';

/** Only the current github.com repository; no PAT, enterprise URL or cross-repository fallback. */
export function githubPublication(config, env, { fetcher = fetch, now = Date.now } = {}) {
  const d = publicationConfiguration(config).destination;
  requireValue(d?.provider === 'github' && d.origin === origin && d.repository === env.GITHUB_REPOSITORY
    && d.id === env.GITHUB_REPOSITORY_ID && d.botId === '41898282' && env.GITHUB_SERVER_URL === 'https://github.com'
    && env.GITHUB_API_URL === origin && env.GITHUB_ACTIONS === 'true' && !env.ARGOS_API_KEY, 'CONFIG_INVALID');
  const token = env.GITHUB_TOKEN;
  requireValue(typeof token === 'string' && /^ghs_[A-Za-z0-9_]{20,255}$/.test(token), 'PUBLICATION_AUTH_FAILED');
  const root = '/repos/' + d.repository.split('/').map(encodeURIComponent).join('/');
  async function request(method, path, body, { signal } = {}, mutation = false) {
    requireValue(path === '/graphql' && method === 'POST' && body?.query === identityQuery
      || path.startsWith(root + '/') || path === root, 'CONFIG_INVALID');
    const limited = AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(15000)]);
    let response;
    try { response = await fetcher(origin + path, { method, redirect: 'error', cache: 'no-store', signal: limited,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10',
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw new Failure('PUBLICATION_STATE_UNKNOWN', { transient: true, ambiguous: mutation }); }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const rate = response.status === 429 || response.status === 403
        && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'));
      const retry = response.headers.get('retry-after');
      const reset = response.headers.get('x-ratelimit-reset');
      const delay = retry && /^\d{1,7}$/.test(retry) ? Number(retry)
        : reset && /^\d{1,12}$/.test(reset) ? Math.max(1, Math.ceil(Number(reset) - now() / 1000)) : null;
      const code = rate ? 'PUBLICATION_RATE_LIMITED' : response.status === 401 ? 'PUBLICATION_AUTH_FAILED'
        : [403, 404, 410, 451].includes(response.status) ? 'DESTINATION_UNAVAILABLE'
        : [400, 422].includes(response.status) ? 'CONFIG_INVALID' : 'PUBLICATION_STATE_UNKNOWN';
      const options = { retryAfterSeconds: delay === null ? null : Math.min(delay, 2764800), transient: rate || response.status >= 500, ambiguous: mutation };
      if (mutation && response.status >= 400 && response.status < 500) throw new PublicationRejected(code, options);
      throw new Failure(code, options);
    }
    requireValue(response.status === (mutation ? 201 : 200), 'PUBLICATION_STATE_UNKNOWN');
    let value;
    try { value = await readJson(response, 1024 * 1024, limited); }
    catch { throw new Failure('PUBLICATION_STATE_UNKNOWN', { ambiguous: mutation }); }
    return { value, headers: response.headers };
  }
  async function readDestination(options) {
    const { value: repo } = await request('GET', root, null, options);
    requireValue(positive(repo.id) && String(repo.id) === d.id && repo.full_name === d.repository && repo.fork === false
      && repo.archived === false && repo.disabled === false && repo.has_issues === true
      && repo.visibility === d.visibility && repo.private === (d.visibility === 'private')
      && typeof repo.default_branch === 'string' && env.GITHUB_REF === `refs/heads/${repo.default_branch}`
      && ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'DESTINATION_UNAVAILABLE');
    const { value } = await request('POST', '/graphql', { query: identityQuery }, options);
    const viewer = value?.data?.viewer;
    requireValue(!value.errors && viewer?.login === 'github-actions[bot]' && viewer.__typename === 'User'
      && positive(viewer.databaseId) && String(viewer.databaseId) === d.botId, 'PUBLICATION_AUTH_FAILED');
    // A read proves destination and identity, never write permission. The POST is authoritative.
    return { ...d, botVerified: true, issuesEnabled: true, conditionalReopen: false };
  }
  function normalize(row) {
    requireValue(row && !row.pull_request && positive(row.number) && positive(row.id) && row.url === origin + root + '/issues/' + row.number
      && ['open', 'closed'].includes(row.state) && timestamp(row.created_at) && timestamp(row.updated_at)
      && positive(row.user?.id) && ['User', 'Bot'].includes(row.user.type)
      && (row.body === null || typeof row.body === 'string') && Buffer.byteLength(row.body ?? '') <= 65536
      && Array.isArray(row.labels) && row.labels.every(l => l && typeof l.name === 'string' && l.name.length <= 100), 'PUBLICATION_STATE_UNKNOWN');
    // Conservative human control: every closure and every argos:* decision label freezes automation.
    // No comment text is interpreted as an authenticated instruction; reopening is unsupported.
    const held = row.state === 'closed' || row.labels.some(l => /^argos:(?:ignore|false-positive|accepted-risk)(?:$|:)/i.test(l.name));
    return { id: String(row.number), destinationId: d.id, authorId: String(row.user.id), isBot: row.user.type === 'Bot', kind: 'issue',
      state: row.state, body: row.body ?? '', revision: fingerprint([row.id, row.updated_at, row.state, row.body, row.labels]), createdAt: row.created_at,
      decision: { kind: held ? 'UNKNOWN' : 'NONE', authorized: false, actorId: null, at: null, until: null,
        version: fingerprint([row.updated_at, row.state, row.labels]) } };
  }
  async function listIssues(cursor, options) {
    requireValue(cursor === null || /^[2-9][0-9]*$|^1[0-9]+$/.test(cursor), 'PUBLICATION_STATE_UNKNOWN');
    const page = cursor === null ? 1 : Number(cursor);
    requireValue(Number.isSafeInteger(page) && page <= 20, 'PUBLICATION_STATE_UNKNOWN');
    const path = root + `/issues?state=all&sort=created&direction=asc&per_page=100&page=${page}`;
    const { value, headers } = await request('GET', path, null, options);
    requireValue(Array.isArray(value) && value.length <= 100, 'PUBLICATION_STATE_UNKNOWN');
    const link = headers.get('link'); let nextCursor = null;
    if (link) {
      const links = link.split(',').map(part => /^\s*<([^>]+)>;\s*rel="(next|prev|first|last)"\s*$/.exec(part));
      requireValue(links.every(Boolean) && new Set(links.map(l => l[2])).size === links.length, 'PUBLICATION_STATE_UNKNOWN');
      for (const [, target, rel] of links) {
        const u = new URL(target), expected = new URL(origin + path);
        requireValue(u.origin === origin && u.pathname === expected.pathname && !u.username && !u.password && !u.hash
          && [...u.searchParams.keys()].sort().join(',') === 'direction,page,per_page,sort,state'
          && ['state', 'sort', 'direction', 'per_page'].every(k => u.searchParams.get(k) === expected.searchParams.get(k))
          && /^[1-9][0-9]*$/.test(u.searchParams.get('page')), 'PUBLICATION_STATE_UNKNOWN');
        if (rel === 'next') { requireValue(Number(u.searchParams.get('page')) === page + 1, 'PUBLICATION_STATE_UNKNOWN'); nextCursor = String(page + 1); }
      }
    }
    // GitHub's issue listing includes PRs. Exclude them as foreign resources, never adopt or mutate them.
    return { items: value.filter(row => !row?.pull_request).map(normalize), nextCursor, complete: nextCursor === null };
  }
  async function readIssue(id, options) {
    requireValue(/^[1-9][0-9]{0,19}$/.test(id));
    return normalize((await request('GET', root + '/issues/' + id, null, options)).value);
  }
  async function createIssue(payload, options) {
    // Fixed public data is checked again at the last boundary before POST.
    requireValue(d.visibility !== 'public' || payload.title === PUBLIC_ISSUE.title && payload.body === PUBLIC_ISSUE.body && payload.labels.length === 0, 'CONFIG_INVALID');
    return normalize((await request('POST', root + '/issues', payload, options, true)).value);
  }
  return { readDestination, listIssues, readIssue, createIssue };
}
