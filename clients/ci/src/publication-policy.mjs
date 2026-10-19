import { createHash } from 'node:crypto';
import { exact, digest, timestamp } from './contracts.mjs';
import { requireValue } from './diagnostics.mjs';

export const PUBLIC_ISSUE = Object.freeze({ title: 'Argos audit: review required',
  body: 'An Argos CI audit requires an authenticated review. Open Argos with your own account. Findings are available only through authenticated access.' });
export const FRESHNESS_MS = 15 * 60 * 1000;
const canonical = v => Array.isArray(v) ? v.map(canonical) : v !== null && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
export const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const domains = ['performance', 'security', 'seo', 'a11y'];
const environments = ['production', 'staging', 'preview'];
const id = v => typeof v === 'string' && /^[1-9][0-9]{0,19}$/.test(v);
const list = (v, choices, max) => Array.isArray(v) && v.length > 0 && v.length <= max && new Set(v).size === v.length && v.every(x => choices.includes(x));
const label = v => typeof v === 'string' && /^[a-z0-9][a-z0-9._:-]{0,39}$/.test(v);

/** Configuration is trusted customer configuration, never taken from a report or issue. */
export function publicationConfiguration(input = {}) {
  requireValue(input !== null && typeof input === 'object' && !Array.isArray(input));
  const defaults = { version: 1, mode: 'DISABLED', destination: null, environments: ['production'], categories: domains,
    severities: ['critical', 'important'], labels: ['argos-ci'], maxNewIssues: 5, maxNotifications: 5,
    allowPrivateDetails: false, allowPublicNotice: false, publicIssueId: null, reopenResolved: false, groups: [] };
  requireValue(Object.keys(input).every(k => Object.hasOwn(defaults, k)));
  const v = { ...defaults, ...input };
  requireValue(v.version === 1 && ['DISABLED', 'PREVIEW', 'SYNC'].includes(v.mode)
    && list(v.environments, environments, 3) && list(v.categories, domains, 4) && list(v.severities, ['critical', 'important'], 2)
    && Array.isArray(v.labels) && v.labels.length <= 10 && v.labels.every(label) && new Set(v.labels).size === v.labels.length
    && Number.isInteger(v.maxNewIssues) && v.maxNewIssues >= 0 && v.maxNewIssues <= 10
    && Number.isInteger(v.maxNotifications) && v.maxNotifications >= 0 && v.maxNotifications <= 20
    && ['allowPrivateDetails', 'allowPublicNotice', 'reopenResolved'].every(k => typeof v[k] === 'boolean'));
  if (v.destination !== null) requireValue(exact(v.destination, ['provider', 'origin', 'id', 'repository', 'visibility', 'botId'])
    && ['github', 'gitlab'].includes(v.destination.provider) && id(v.destination.id) && id(v.destination.botId)
    && v.destination.origin === (v.destination.provider === 'github' ? 'https://api.github.com' : 'https://gitlab.com')
    && typeof v.destination.repository === 'string' && v.destination.repository.length <= 256
    && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+){1,15}$/.test(v.destination.repository)
    && ['private', 'public'].includes(v.destination.visibility));
  if (v.mode === 'SYNC') requireValue(v.destination !== null);
  requireValue(v.publicIssueId === null || id(v.publicIssueId) && v.destination?.visibility === 'public');
  requireValue(Array.isArray(v.groups) && v.groups.length <= 20);
  const names = new Set(), scopes = new Set();
  for (const group of v.groups) {
    requireValue(exact(group, ['id', 'scopes']) && typeof group.id === 'string' && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(group.id)
      && !names.has(group.id) && Array.isArray(group.scopes) && group.scopes.length > 0 && group.scopes.length <= 100);
    names.add(group.id);
    for (const scope of group.scopes) { requireValue(digest(scope) && !scopes.has(scope)); scopes.add(scope); }
  }
  return structuredClone(v);
}
export function selectFindings(evidence, config) {
  if (evidence.verdict.outcome === 'CONTROL_FAILED' || !config.environments.includes(evidence.provenance.environment)) return [];
  return evidence.verdict.confirmedFindings.filter(f => f.ticketEligible && config.categories.includes(f.category) && config.severities.includes(f.severity))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1) || a.key.localeCompare(b.key, 'en'));
}
export function previewConfiguration(env) {
  const csv = (name, fallback) => env[name] === undefined ? fallback : env[name] === '' ? [] : env[name].split(',');
  return publicationConfiguration({ mode: 'PREVIEW', environments: csv('ARGOS_PUBLICATION_ENVIRONMENTS', environments),
    categories: csv('ARGOS_PUBLICATION_CATEGORIES', domains), severities: csv('ARGOS_PUBLICATION_SEVERITIES', ['critical', 'important']),
    labels: csv('ARGOS_PUBLICATION_LABELS', ['argos-ci']), maxNewIssues: Number(env.ARGOS_PUBLICATION_MAX_NEW ?? '5') });
}
export function candidates(evidence, config) {
  const selected = selectFindings(evidence, config), d = config.destination;
  if (!selected.length) return [];
  requireValue(d, 'CONFIG_INVALID');
  if (d.visibility === 'public') {
    requireValue(config.allowPublicNotice, 'DESTINATION_UNAVAILABLE');
    // One fixed notice per destination: no target, environment, correlation ID or finding is published.
    return [{ fingerprint: fingerprint(['argos-public-notice-v1', d.provider, d.origin, d.id]), key: null, scopes: [], environment: null, notice: true }];
  }
  requireValue(config.allowPrivateDetails, 'DESTINATION_UNAVAILABLE');
  const scope = evidence.verdict.fingerprints.scope, group = config.groups.find(g => g.scopes.includes(scope));
  const target = group ? ['group', group.id] : ['scope', scope];
  return selected.map(f => ({ fingerprint: fingerprint(['argos-issue-v1', d.provider, d.origin, d.id, evidence.provenance.environment, target, f.key]),
    key: f.key, scopes: group ? group.scopes : [scope], environment: evidence.provenance.environment, notice: false }));
}
export function managedBlock(candidate, nonce) {
  requireValue(digest(candidate.fingerprint) && digest(nonce));
  if (candidate.notice) return PUBLIC_ISSUE.body;
  return `<!-- argos-ci-issue-v1:${candidate.fingerprint}:${nonce} -->\n`
    + `Argos confirmed this catalogued check in two comparable measurements: \`${candidate.key}\`.\n`
    + `Declared environment: \`${candidate.environment}\`. Configured target scopes: ${[...candidate.scopes].sort().map(s => '`' + s + '`').join(', ')}.\n`
    + 'Review the private results in Argos with your own account. No access credential is included here.\n<!-- /argos-ci-issue-v1 -->';
}
export function issueTitle(candidate) { return candidate.notice ? PUBLIC_ISSUE.title : `Argos: ${candidate.key}`; }
export function decisionBlocks(issue, evidence, config, now) {
  const d = issue.decision;
  if (d.kind === 'UNKNOWN' || d.kind !== 'NONE' && !d.authorized) return true;
  if (['IGNORED', 'FALSE_POSITIVE', 'ACCEPTED_RISK'].includes(d.kind)) return d.until === null || Date.parse(d.until) > now;
  if (issue.state !== 'closed') return false;
  if (!config.reopenResolved || d.kind === 'NONE') return true;
  // Refreshing an old artifact after a human resolution is not a new observation.
  const boundary = d.kind === 'RESOLVED' ? d.at : d.until;
  return boundary === null || Date.parse(evidence.observationStartedAt) <= Date.parse(boundary);
}
export function validDecision(d) {
  return exact(d, ['kind', 'authorized', 'actorId', 'at', 'until', 'version'])
    && ['NONE', 'RESOLVED', 'IGNORED', 'FALSE_POSITIVE', 'ACCEPTED_RISK', 'UNKNOWN'].includes(d.kind)
    && typeof d.authorized === 'boolean' && (d.actorId === null || id(d.actorId))
    && (d.at === null || timestamp(d.at)) && (d.until === null || timestamp(d.until))
    && typeof d.version === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(d.version)
    && (d.kind !== 'NONE' || d.authorized === false && d.actorId === null && d.at === null && d.until === null)
    && (d.kind !== 'RESOLVED' || d.until === null)
    && (d.kind === 'NONE' || !d.authorized || id(d.actorId) && timestamp(d.at))
    && (d.until === null || d.at !== null && Date.parse(d.until) > Date.parse(d.at));
}
