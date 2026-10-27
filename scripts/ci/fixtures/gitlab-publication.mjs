import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { main } from '../../../clients/ci/src/client.mjs';
import { gitlabPublication } from '../../../clients/ci/src/gitlab-publication.mjs';
import { publicationConfiguration, PUBLIC_ISSUE } from '../../../clients/ci/src/publication-policy.mjs';
import { writePrivate } from '../../../clients/ci/src/evidence.mjs';
import { VERSION, policy } from '../../../clients/ci/src/resources.mjs';

const clock = Date.parse('2026-10-19T00:00:00Z'), now = () => clock, iso = n => new Date(clock + n).toISOString();
const destination = { provider: 'gitlab', origin: 'https://gitlab.com', id: '42', repository: 'customer/site', visibility: 'private', botId: '101' };
const configuration = publicationConfiguration({ mode: 'SYNC', destination, allowPrivateDetails: true });
const provenance = { provider: 'gitlab', repository: 'customer/site', sha: 'a'.repeat(40), invocation: '123:1', producerId: '789', environment: 'production' };
const verdict = { apiVersion: 1, kind: 'verdict-v1', admissionId: 'a2942a5c-b63a-45cd-a88a-d02b1af5db02', policyId: policy.policyId,
  policyFingerprint: policy.fingerprint, sampleCount: 2, outcome: 'GO', exitCode: 0, error: null,
  fingerprints: { scoring: 'b'.repeat(64), measurement: 'c'.repeat(64), scope: 'd'.repeat(64), evidence: 'e'.repeat(64) },
  confirmedFindings: [{ key: 'http.security.csp', category: 'security', severity: 'important', ticketEligible: true }] };
const evidence = { schemaVersion: 2, kind: 'ci-evidence-v2', clientVersion: VERSION, provenance, issuedAt: iso(-1000), observationStartedAt: iso(-10000),
  sourceExpiresAt: iso(86400000), expiresAt: iso(86400000), admissionId: verdict.admissionId, samples: 2, runIds: ['1', '2'], verdict };
const readToken = 'glpat-' + 'r'.repeat(24), writeToken = 'glpat-' + 'w'.repeat(24);
const sas = access => 'https://argosfixture.blob.core.windows.net/private/gitlab.json?' + new URLSearchParams({ sv: '2023-11-03',
  spr: 'https', sp: access, sr: 'b', se: iso(86400000), sig: Buffer.alloc(32, 9).toString('base64') });

export function fixture(t, input = configuration, proof = evidence) {
  const root = fs.mkdtempSync(join(tmpdir(), 'argos-gitlab-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['control', 'publisher']) fs.mkdirSync(join(root, dir));
  const digest = writePrivate(join(root, 'control/evidence.json'), proof);
  const state = { issues: [], calls: [], posts: [], attempts: 0, lease: null, etag: 1, trace: '', pages: null, jobPages: null,
    bot: true, kind: 'project-token', role: 15, visibility: input.destination.visibility, archived: false, issuesAccess: 'enabled', keepLatest: false,
    readScopes: ['read_api'], writeScopes: ['api'], tokenActive: true, tokenRevoked: false, tokenExpiry: '2026-10-20', identity: 101,
    foreignMember: false, lose: false, hide: false, corruptPage: false, status: null, postStatus: null, publicStorage: false, sourceChange: null,
    envelope: { version: 1, destinationId: '42', repository: 'customer/site', evidenceKey: randomBytes(32).toString('base64'),
      journal: { version: 1, revision: 'initial', destinationId: '42', records: [], budgets: [] } } };
  const user = id => ({ id, state: 'active', locked: false, is_admin: false, bot: id === 101 ? state.bot : true,
    username: id === 101 && !state.bot ? 'dedicated-automation' : `project_42_bot_${id}` });
  const source = () => ({ id: 789, name: 'argos_control', status: 'failed', pipeline: { id: 123, project_id: 42, sha: provenance.sha },
    commit: { id: provenance.sha }, ref: 'main', erased_at: null, finished_at: iso(-500), artifacts_expire_at: iso(6 * 86400000), ...state.sourceChange });
  const row = payload => ({ id: 1000 + state.issues.length, iid: state.issues.length + 1, project_id: 42, issue_type: 'issue', state: 'opened',
    title: payload.title, description: payload.description, labels: payload.labels ? payload.labels.split(',') : [], confidential: payload.confidential,
    author: user(101), created_at: iso(0), updated_at: iso(0), moved_to_id: null });
  async function fetcher(url, options) {
    const u = new URL(url), headers = new Headers(options.headers); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    state.calls.push({ origin: u.origin, method: options.method, path: u.pathname });
    assert.notEqual(u.origin, 'https://argos.lelouet.fr', 'No audit/API key in publisher');
    if (u.hostname.endsWith('.blob.core.windows.net')) {
      assert.equal(headers.get('private-token'), null); assert.equal(headers.get('authorization'), null);
      const send = (value, status, extra = {}) => new Response(value === null ? null : JSON.stringify(value), { status,
        headers: { 'content-type': 'application/json', 'x-ms-request-id': 'fixture', ...extra } });
      if (!u.search) return send(null, state.publicStorage ? 200 : 403);
      if (u.searchParams.has('comp')) {
        assert.equal(u.searchParams.get('sp'), 'rw'); const action = headers.get('x-ms-lease-action');
        if (action === 'acquire') { if (state.lease) return send(null, 409); state.lease = headers.get('x-ms-proposed-lease-id'); }
        else if (headers.get('x-ms-lease-id') !== state.lease) return send(null, 412);
        const lease = state.lease; if (action === 'release') state.lease = null;
        return send(null, action === 'acquire' ? 201 : 200, { 'x-ms-lease-id': lease });
      }
      if (options.method === 'PUT') {
        assert.equal(u.searchParams.get('sp'), 'rw');
        if (!state.lease || headers.get('x-ms-lease-id') !== state.lease || headers.get('if-match') !== `"${state.etag}"`) return send(null, 412);
        state.envelope = JSON.parse(options.body); state.etag++; await state.onSave?.(); return send(null, 201, { etag: `"${state.etag}"` });
      }
      return send(state.envelope, 200, { etag: `"${state.etag}"`, 'x-ms-blob-type': 'BlockBlob' });
    }
    assert.equal(u.origin, 'https://gitlab.com'); assert.equal(headers.get('authorization'), null);
    const token = headers.get('private-token'); assert.ok([readToken, writeToken].includes(token));
    const read = token === readToken;
    if (state.status) return new Response('synthetic-private-740 ::error::', { status: state.status,
      headers: state.status === 429 ? { 'retry-after': '60' } : {} });
    if (u.pathname === '/api/v4/user') return Response.json(user(read ? 202 : state.identity));
    if (u.pathname === '/api/v4/users/101') return Response.json(user(101));
    if (u.pathname === '/api/v4/personal_access_tokens/self') return Response.json({ id: read ? 91 : 92, user_id: read ? 202 : state.identity,
      scopes: read ? state.readScopes : state.writeScopes, active: state.tokenActive, revoked: state.tokenRevoked, expires_at: state.tokenExpiry });
    if (u.pathname === '/api/v4/projects') return Response.json(state.foreignMember ? [{ id: 42 }, { id: 43 }] : [{ id: 42 }], { headers: { 'x-next-page': '' } });
    if (u.pathname === '/api/v4/projects/42') return Response.json({ id: 42, path_with_namespace: 'customer/site', visibility: state.visibility,
      archived: state.archived, default_branch: 'main', issues_access_level: state.issuesAccess, keep_latest_artifact: state.keepLatest });
    if (u.pathname === '/api/v4/projects/42/members/all/101') return Response.json({ id: 101, access_level: state.role, expires_at: null });
    if (u.pathname.includes('/pipelines/123/jobs')) {
      const page = Number(u.searchParams.get('page')), pages = state.jobPages ?? [[source()]];
      return Response.json(pages[page - 1], { headers: { 'x-next-page': page < pages.length ? String(page + 1) : '' } });
    }
    if (u.pathname === '/api/v4/projects/42/jobs/789') return Response.json(source());
    if (u.pathname.endsWith('/jobs/789/trace')) return new Response(state.trace, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (options.method === 'POST') {
      assert.equal(token, writeToken); assert.equal(state.envelope.journal.records.at(-1).phase, 'CREATE_PENDING'); state.attempts++;
      if (state.postStatus) return new Response('synthetic-private-740', { status: state.postStatus });
      const payload = JSON.parse(options.body); state.posts.push(payload); const created = row(payload); state.issues.push(created);
      if (state.lose) throw new Error('synthetic-private-740'); return Response.json(created, { status: 201 });
    }
    if (u.pathname === '/api/v4/projects/42/issues') {
      const page = Number(u.searchParams.get('page')), pages = state.hide ? [[]] : state.pages ?? [state.issues];
      const next = page < pages.length ? String(page + 1) : '';
      return Response.json(pages[page - 1], { headers: { 'x-next-page': next,
        ...(state.corruptPage ? { link: '<https://elsewhere.invalid/issues?page=2>; rel="next"' } : {}) } });
    }
    return Response.json(state.issues.find(r => u.pathname.endsWith('/issues/' + r.iid)));
  }
  const env = { GITLAB_CI: 'true', CI_SERVER_URL: 'https://gitlab.com', CI_API_V4_URL: 'https://gitlab.com/api/v4', CI_PROJECT_PATH: 'customer/site',
    CI_PROJECT_ID: '42', CI_PIPELINE_ID: '123', CI_COMMIT_SHA: provenance.sha, CI_JOB_ID: '789', CI_JOB_NAME: 'argos_control',
    CI_COMMIT_BRANCH: 'main', CI_DEFAULT_BRANCH: 'main', CI_COMMIT_REF_PROTECTED: 'true', CI_PIPELINE_SOURCE: 'push',
    ARGOS_PUBLICATION_CONFIG: JSON.stringify(input), ARGOS_GITLAB_READ_TOKEN: readToken, ARGOS_EVIDENCE_SHA256: digest,
    ARGOS_GITLAB_JOURNAL_READ_SAS_URL: sas('r'), ARGOS_OUTPUT_DIR: join(root, 'control') };
  async function stage() { return main(['publication-stage'], env, { fetcher, now }); }
  async function prepare() {
    const sealed = await stage(); assert.equal(sealed.proofStaged, true);
    state.trace = JSON.stringify({ clientVersion: VERSION, command: 'audit', auditOutcome: proof.verdict.outcome, auditExitCode: proof.verdict.exitCode,
      exitCode: proof.verdict.exitCode, evidenceSha256: digest }) + '\n' + JSON.stringify(sealed) + '\n';
    fs.copyFileSync(join(root, 'control/evidence.enc.json'), join(root, 'publisher/evidence.enc.json')); fs.unlinkSync(join(root, 'control/evidence.enc.json'));
  }
  const publish = extra => main(['publish-gitlab'], { ...env, CI_JOB_ID: '790', CI_JOB_NAME: 'argos_publish', ARGOS_OUTPUT_DIR: join(root, 'publisher'),
    ARGOS_GITLAB_PUBLISH_TOKEN: writeToken, ARGOS_GITLAB_JOURNAL_SAS_URL: sas('rw'), ...extra }, { fetcher, now, sleep: async () => {} });
  return { root, state, env, fetcher, stage, prepare, publish, row, source, api: (read = false) => gitlabPublication(input,
    { ...env, ARGOS_GITLAB_PUBLISH_TOKEN: writeToken }, { fetcher, now }, read) };
}


export { clock, now, iso, destination, configuration, provenance, verdict, evidence, readToken, writeToken };
