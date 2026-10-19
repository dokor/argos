import { randomBytes } from 'node:crypto';
import { readTrusted } from './evidence.mjs';
import { exact, digest, timestamp } from './contracts.mjs';
import { policy, catalogue, errors } from './resources.mjs';
import { validVerdict } from '../../../apps/console-web/src/lib/ci-verdict-contract.mjs';
import { pipelineResult } from '../../../scripts/ci/ci-verdict.mjs';
import { recoveryDecision } from '../../../scripts/ci/ci-errors.mjs';
import { Failure, diagnostic, requireValue } from './diagnostics.mjs';
import { publicationConfiguration, candidates, managedBlock, issueTitle, validDecision, decisionBlocks, fingerprint, FRESHNESS_MS } from './publication-policy.mjs';
import { setTimeout as wait } from 'node:timers/promises';

/** Only a connector's definite rejection can release a pending creation. Unknowns cannot. */
export class PublicationRejected extends Failure {
  constructor(code, options) {
    requireValue(['PUBLICATION_AUTH_FAILED', 'DESTINATION_UNAVAILABLE', 'PUBLICATION_RATE_LIMITED', 'CONFIG_INVALID'].includes(code));
    super(code, options);
  }
}
const positive = v => typeof v === 'string' && /^[1-9][0-9]{0,19}$/.test(v);
const revision = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
const statuses = ['CREATE_PENDING', 'ACTIVE', 'REOPEN_PENDING'];
function validIssue(v, destination) {
  return exact(v, ['id', 'destinationId', 'authorId', 'isBot', 'kind', 'state', 'body', 'revision', 'createdAt', 'decision'])
    && positive(v.id) && v.destinationId === destination.id && positive(v.authorId) && typeof v.isBot === 'boolean'
    && v.kind === 'issue' && ['open', 'closed'].includes(v.state) && typeof v.body === 'string' && Buffer.byteLength(v.body) <= 65536
    && revision(v.revision) && timestamp(v.createdAt) && validDecision(v.decision);
}
function validateJournal(v, destination) {
  requireValue(exact(v, ['version', 'revision', 'destinationId', 'records', 'budgets']) && v.version === 1 && revision(v.revision)
    && v.destinationId === destination.id && Array.isArray(v.records) && v.records.length <= 2000 && Array.isArray(v.budgets) && v.budgets.length <= 1000, 'PUBLICATION_STATE_UNKNOWN');
  const seen = new Set(), issueIds = new Set();
  for (const r of v.records) {
    requireValue(exact(r, ['fingerprint', 'nonce', 'notice', 'key', 'scopes', 'environment', 'phase', 'issueId', 'startedAt', 'operationInvocation'])
      && digest(r.fingerprint) && !seen.has(r.fingerprint) && digest(r.nonce) && typeof r.notice === 'boolean'
      && statuses.includes(r.phase) && (r.phase === 'CREATE_PENDING' ? r.issueId === null : positive(r.issueId))
      && timestamp(r.startedAt) && digest(r.operationInvocation) && Array.isArray(r.scopes) && r.scopes.length <= 100
      && new Set(r.scopes).size === r.scopes.length && r.scopes.every(digest)
      && (r.notice ? r.key === null && r.environment === null && r.scopes.length === 0
        : typeof r.key === 'string' && Object.hasOwn(catalogue, r.key) && ['production', 'staging', 'preview'].includes(r.environment) && r.scopes.length > 0), 'PUBLICATION_STATE_UNKNOWN');
    requireValue(r.issueId === null || !issueIds.has(r.issueId), 'PUBLICATION_STATE_UNKNOWN');
    if (r.issueId !== null) issueIds.add(r.issueId);
    seen.add(r.fingerprint);
  }
  const budgets = new Set();
  for (const b of v.budgets) {
    requireValue(exact(b, ['invocation', 'newIssues', 'notifications']) && digest(b.invocation) && !budgets.has(b.invocation)
      && Number.isSafeInteger(b.newIssues) && b.newIssues >= 0 && Number.isSafeInteger(b.notifications) && b.notifications >= 0, 'PUBLICATION_STATE_UNKNOWN');
    budgets.add(b.invocation);
  }
  requireValue(Buffer.byteLength(JSON.stringify(v)) <= 1024 * 1024, 'PUBLICATION_STATE_UNKNOWN');
  return structuredClone(v);
}
function owned(issue, record, destination) {
  requireValue(issue && issue.authorId === destination.botId && issue.isBot && issue.destinationId === destination.id, 'PUBLICATION_STATE_UNKNOWN');
  const block = managedBlock(record, record.nonce);
  if (record.notice) return issue.body === block;
  const marker = `<!-- argos-ci-issue-v1:${record.fingerprint}:${record.nonce} -->`;
  const start = issue.body.indexOf(marker), end = issue.body.indexOf('<!-- /argos-ci-issue-v1 -->', start);
  return start >= 0 && end >= start && issue.body.indexOf(marker, start + marker.length) < 0
    && issue.body.slice(start, end + '<!-- /argos-ci-issue-v1 -->'.length) === block;
}
function result(verdict, publication, counts, code, lang) {
  const valid = validVerdict(verdict, policy, catalogue, errors);
  const base = valid ? pipelineResult(verdict, { publication }) : { auditOutcome: 'UNKNOWN', auditExitCode: null, publication,
    exitCode: publication === 'DISABLED' ? 0 : 3, errorCode: publication === 'DISABLED' ? null : code ?? 'ARTIFACT_INVALID' };
  return { ...base, counts: structuredClone(counts), ...(code ? { diagnostic: diagnostic(new Failure(code), lang) } : {}) };
}

/** Common engine only. Connectors #739/#740 must provide the fenced durable session contract. */
export async function synchronizeIssues({ evidencePath, expected, auditVerdict = null, config: input, adapter, signal = new AbortController().signal,
  now = Date.now, sleep = (ms, s) => wait(ms, undefined, { signal: s }), random = Math.random, timeoutMs = 120000, lang = 'fr' } = {}) {
  const counts = { created: 0, reopened: 0, reconciled: 0, suppressed: 0, unchanged: 0, limited: 0 };
  const lifetime = new AbortController();
  let verdict = auditVerdict, config;
  try {
    config = publicationConfiguration(input);
    if (config.mode === 'DISABLED') return result(verdict, 'DISABLED', counts, null, lang);
    if (auditVerdict !== null) {
      requireValue(validVerdict(auditVerdict, policy, catalogue, errors), 'ARTIFACT_INVALID');
      if (auditVerdict.outcome === 'CONTROL_FAILED') return result(auditVerdict, 'DISABLED', counts, auditVerdict.error.code, lang);
    }
    requireValue(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 600000);
    const deadline = now() + timeoutMs, combined = AbortSignal.any([signal, lifetime.signal, AbortSignal.timeout(timeoutMs)]);
    let evidence;
    try { evidence = readTrusted(evidencePath, { ...expected, now: now() }); } catch { throw new Failure('ARTIFACT_INVALID'); }
    requireValue(auditVerdict === null || fingerprint(auditVerdict) === fingerprint(evidence.verdict), 'ARTIFACT_INVALID');
    verdict = evidence.verdict;
    const fresh = () => requireValue(Date.parse(evidence.issuedAt) <= now() && now() - Date.parse(evidence.issuedAt) <= FRESHNESS_MS
      && Date.parse(evidence.sourceExpiresAt) > now() && Date.parse(evidence.expiresAt) > now(), 'ARTIFACT_INVALID');
    fresh();
    const desired = candidates(evidence, config);
    if (!desired.length) return result(verdict, 'NO_FINDINGS', counts, null, lang);
    requireValue(config.destination !== null && adapter, 'CONFIG_INVALID');
    const destination = config.destination;
    const lockKey = fingerprint(['argos-issue-destination-v1', destination.provider, destination.origin, destination.id]);
    const invocation = fingerprint([lockKey, evidence.provenance.repository, evidence.provenance.invocation.split(':')[0]]);
    async function call(operation, maximum = 15000) {
      combined.throwIfAborted(); requireValue(now() < deadline, 'PUBLICATION_STATE_UNKNOWN');
      const controller = new AbortController(); let timer;
      const cancel = () => controller.abort();
      combined.addEventListener('abort', cancel, { once: true });
      try {
        return await new Promise((resolve, reject) => {
          const abort = () => reject(new Failure('PUBLICATION_STATE_UNKNOWN', { transient: true, ambiguous: true }));
          controller.signal.addEventListener('abort', abort, { once: true });
          timer = setTimeout(cancel, Math.min(maximum, deadline - now()));
          Promise.resolve().then(() => operation({ signal: controller.signal })).then(resolve, reject);
        });
      } finally { clearTimeout(timer); combined.removeEventListener('abort', cancel); controller.abort(); }
    }
    async function read(operation) {
      for (let attempt = 1; ; attempt++) {
        combined.throwIfAborted(); requireValue(now() < deadline, 'PUBLICATION_STATE_UNKNOWN');
        try { return await call(operation); }
        catch (e) {
          if (!(e instanceof Failure) || !e.transient || !errors[e.code]?.retryable) throw e;
          const next = recoveryDecision({ protocolValid: true, retryable: true, retryAfterSeconds: e.retryAfterSeconds },
            { operation: 'READ', attempt, maxAttempts: 3, remainingMs: deadline - now(), jitter: random() });
          if (next.action === 'STOP') throw e;
          await sleep(next.delayMs, combined);
        }
      }
    }
    async function checkDestination(session) {
      const actual = await read(options => session.readDestination(options));
      requireValue(exact(actual, [...Object.keys(destination), 'botVerified', 'issuesEnabled', 'conditionalReopen'])
        && Object.keys(destination).every(k => actual[k] === destination[k]) && actual.botVerified === true && actual.issuesEnabled === true
        && typeof actual.conditionalReopen === 'boolean', 'DESTINATION_UNAVAILABLE');
      requireValue(!config.reopenResolved || actual.conditionalReopen, 'CONFIG_INVALID');
    }
    async function inventory(session) {
      let cursor = null, bytes = 0; const rows = [], cursors = new Set(), ids = new Set();
      for (let page = 0; page < 20; page++) {
        const response = await read(options => session.listIssues(cursor, { ...options, limit: 100 }));
        requireValue(exact(response, ['items', 'nextCursor', 'complete']) && Array.isArray(response.items) && response.items.length <= 100
          && typeof response.complete === 'boolean' && (response.nextCursor === null ? response.complete : !response.complete && revision(response.nextCursor)), 'PUBLICATION_STATE_UNKNOWN');
        for (const issue of response.items) {
          requireValue(validIssue(issue, destination) && !ids.has(issue.id), 'PUBLICATION_STATE_UNKNOWN');
          bytes += Buffer.byteLength(issue.body) + 512; requireValue(bytes <= 1024 * 1024, 'PUBLICATION_STATE_UNKNOWN');
          ids.add(issue.id); rows.push(issue);
        }
        if (response.complete) return rows;
        requireValue(!cursors.has(response.nextCursor), 'PUBLICATION_STATE_UNKNOWN'); cursors.add(response.nextCursor); cursor = response.nextCursor;
      }
      throw new Failure('PUBLICATION_STATE_UNKNOWN');
    }
    async function run(session, writing) {
      let lease;
      async function guard() {
        combined.throwIfAborted(); fresh(); requireValue(now() < deadline, 'PUBLICATION_STATE_UNKNOWN');
        if (writing) {
          const next = await call(options => session.assertHeld(options));
          requireValue(exact(next, ['key', 'fence', 'validUntil']) && next.key === lockKey && Number.isSafeInteger(next.fence) && next.fence > 0
            && timestamp(next.validUntil) && Date.parse(next.validUntil) > now() && (!lease || lease.fence === next.fence), 'PUBLICATION_STATE_UNKNOWN');
          lease = next;
        }
      }
      if (writing) requireValue(session.capabilities?.version === 1 && session.capabilities.durableJournal === true
        && session.capabilities.privateJournal === true && session.capabilities.fencedLease === true, 'CONFIG_INVALID');
      await guard(); await checkDestination(session);
      const journal = validateJournal(await read(options => session.loadJournal(options)), destination);
      let issues = await inventory(session), budget = journal.budgets.find(b => b.invocation === invocation);
      if (!budget) { budget = { invocation, newIssues: 0, notifications: 0 }; journal.budgets.push(budget); }
      async function save() {
        await guard(); validateJournal(journal, destination);
        const saved = await call(options => session.saveJournal(structuredClone(journal), { expectedRevision: journal.revision, lease, ...options }));
        requireValue(exact(saved, ['revision', 'committed']) && revision(saved.revision) && saved.revision !== journal.revision
          && saved.committed === true, 'PUBLICATION_STATE_UNKNOWN'); journal.revision = saved.revision;
      }
      async function beforeMutation() { await guard(); await checkDestination(session); await guard(); }
      async function preparedGate(rollback) {
        try { await beforeMutation(); }
        catch (e) {
          // No Git mutation has been invoked. A live fenced session can safely undo its preparation.
          rollback(); await save(); throw e;
        }
      }
      function match(record, pending = false) {
        if (pending && record.notice && !config.publicIssueId) return null; // Never infer ownership from a fixed public message.
        const matches = issues.filter(i => record.issueId ? i.id === record.issueId
          : record.notice ? i.id === config.publicIssueId : i.body.includes(`<!-- argos-ci-issue-v1:${record.fingerprint}:${record.nonce} -->`));
        requireValue(matches.length <= 1, 'PUBLICATION_STATE_UNKNOWN');
        const issue = matches[0];
        if (issue) { requireValue(issue.authorId === destination.botId && issue.isBot, 'PUBLICATION_STATE_UNKNOWN');
          if (pending) requireValue(owned(issue, record, destination), 'PUBLICATION_STATE_UNKNOWN');
          if (pending && !record.notice) requireValue(Date.parse(issue.createdAt) >= Date.parse(record.startedAt) - 10000 && Date.parse(issue.createdAt) <= now() + 1000, 'PUBLICATION_STATE_UNKNOWN'); }
        return issue;
      }
      for (const candidate of desired) {
        await guard();
        const conflicts = journal.records.filter(r => !candidate.notice && !r.notice && r.key === candidate.key && r.environment === candidate.environment
          && r.fingerprint !== candidate.fingerprint && r.scopes.some(s => candidate.scopes.includes(s)));
        requireValue(conflicts.length === 0, 'CONFIG_INVALID');
        let record = journal.records.find(r => r.fingerprint === candidate.fingerprint);
        if (record) requireValue(record.key === candidate.key && record.environment === candidate.environment && record.notice === candidate.notice
          && fingerprint([...record.scopes].sort()) === fingerprint([...candidate.scopes].sort())
          && (!config.publicIssueId || !record.notice || !record.issueId || record.issueId === config.publicIssueId), 'CONFIG_INVALID');
        if (record?.phase === 'CREATE_PENDING') {
          const found = match(record, true); requireValue(found, 'PUBLICATION_STATE_UNKNOWN');
          record.issueId = found.id; record.phase = 'ACTIVE'; if (writing) await save(); counts.reconciled++;
        }
        if (record?.phase === 'REOPEN_PENDING') {
          const found = match(record); requireValue(found?.state === 'open', 'PUBLICATION_STATE_UNKNOWN');
          record.phase = 'ACTIVE'; if (writing) await save(); counts.reconciled++;
        }
        if (record) {
          const existing = match(record); requireValue(existing, 'PUBLICATION_STATE_UNKNOWN');
          // Human edits to the managed text freeze automation. Other notes and fields are never sent back.
          if (!owned(existing, record, destination) || decisionBlocks(existing, evidence, config, now())) { counts.suppressed++; continue; }
          if (existing.state === 'open') { counts.unchanged++; continue; }
          if (budget.notifications >= config.maxNotifications) { counts.limited++; continue; }
          if (!writing) { budget.notifications++; counts.reopened++; continue; }
          const current = await read(options => session.readIssue(existing.id, options));
          requireValue(validIssue(current, destination), 'PUBLICATION_STATE_UNKNOWN');
          if (current.revision !== existing.revision || current.decision.version !== existing.decision.version || !owned(current, record, destination)
            || decisionBlocks(current, evidence, config, now())) { counts.suppressed++; continue; }
          record.phase = 'REOPEN_PENDING'; budget.notifications++; await save(); await preparedGate(() => { record.phase = 'ACTIVE'; });
          try {
            const updated = await call(options => session.reopenIssue({ id: current.id, expectedRevision: current.revision, decisionVersion: current.decision.version }, { lease, ...options }));
            requireValue(validIssue(updated, destination) && updated.id === current.id && updated.state === 'open' && owned(updated, record, destination), 'PUBLICATION_STATE_UNKNOWN');
            issues = issues.map(i => i.id === updated.id ? updated : i); record.phase = 'ACTIVE'; await save(); counts.reopened++;
          } catch (e) {
            if (e instanceof PublicationRejected) { record.phase = 'ACTIVE'; await save(); throw e; }
            issues = await inventory(session); const recovered = match(record);
            requireValue(recovered?.state === 'open', 'PUBLICATION_STATE_UNKNOWN'); record.phase = 'ACTIVE'; await save(); counts.reconciled++;
          }
          continue;
        }
        // A copied marker is not an ownership receipt, even if another automation authored it.
        requireValue(candidate.notice || !issues.some(i => i.body.includes(`<!-- argos-ci-issue-v1:${candidate.fingerprint}:`)), 'PUBLICATION_STATE_UNKNOWN');
        if (candidate.notice && config.publicIssueId) {
          record = { ...candidate, nonce: randomBytes(32).toString('hex'), phase: 'CREATE_PENDING', issueId: null, startedAt: new Date(now()).toISOString(), operationInvocation: invocation };
          const chosen = match(record, true); requireValue(chosen, 'PUBLICATION_STATE_UNKNOWN');
          record.phase = 'ACTIVE'; record.issueId = chosen.id; journal.records.push(record);
          if (writing) await save(); counts.reconciled++; continue;
        }
        if (budget.newIssues >= config.maxNewIssues || budget.notifications >= config.maxNotifications) { counts.limited++; continue; }
        if (!writing) { budget.newIssues++; budget.notifications++; counts.created++; continue; }
        record = { ...candidate, nonce: randomBytes(32).toString('hex'), phase: 'CREATE_PENDING', issueId: null, startedAt: new Date(now()).toISOString(), operationInvocation: invocation };
        journal.records.push(record); budget.newIssues++; budget.notifications++; await save();
        await preparedGate(() => { journal.records = journal.records.filter(r => r !== record); });
        try {
          const created = await call(options => session.createIssue({ title: issueTitle(candidate), body: managedBlock(candidate, record.nonce), labels: candidate.notice ? [] : config.labels }, { lease, ...options }));
          requireValue(validIssue(created, destination) && owned(created, record, destination), 'PUBLICATION_STATE_UNKNOWN');
          record.issueId = created.id; record.phase = 'ACTIVE'; issues.push(created); await save(); counts.created++;
        } catch (e) {
          if (e instanceof PublicationRejected) { journal.records = journal.records.filter(r => r !== record); await save(); throw e; }
          issues = await inventory(session); const recovered = match(record, true);
          requireValue(recovered, 'PUBLICATION_STATE_UNKNOWN'); record.issueId = recovered.id; record.phase = 'ACTIVE'; await save(); counts.reconciled++;
        }
      }
      return result(verdict, config.mode === 'PREVIEW' ? 'PREVIEW' : counts.limited ? 'LIMIT_REACHED' : 'SUCCEEDED', counts, null, lang);
    }
    if (config.mode === 'PREVIEW') return await run(adapter, false);
    requireValue(typeof adapter.withDestinationLease === 'function', 'CONFIG_INVALID');
    let executions = 0, outcome;
    await call(options => adapter.withDestinationLease(lockKey, async session => {
      requireValue(++executions === 1, 'PUBLICATION_STATE_UNKNOWN');
      outcome = await run(session, true);
    }, options), timeoutMs);
    requireValue(executions === 1 && outcome !== undefined, 'PUBLICATION_STATE_UNKNOWN');
    return outcome;
  } catch (e) {
    const code = e instanceof Failure ? e.code : 'PUBLICATION_STATE_UNKNOWN';
    return result(verdict, code === 'PUBLICATION_STATE_UNKNOWN' ? 'UNKNOWN' : 'FAILED', counts, code, lang);
  } finally { lifetime.abort(); }
}
