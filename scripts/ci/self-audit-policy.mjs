import { createHash } from 'node:crypto';

export const SITE = 'https://argos.lelouet.fr';
export const POLICY = 'self-audit-v2';
// Ticket identity survives verdict policy changes, including existing v1 tickets.
const TICKET_NAMESPACE = 'self-audit-v1';
const TRANSFER_LIMITATION = 'runtime-transfer-size-unavailable-after-fetch-abort';
export const SERVICES = ['api-backend', 'console-web', 'playwright-service', 'lighthouse-service'];
export const SHA = /^[a-f0-9]{40}$/;
const DOMAINS = ['performance', 'security', 'seo', 'a11y'];
// Java canonicalizes the root without a slash; HTTP clients may serialize it with one.
const isHomepage = value => value === SITE || value === SITE + '/';
// Reviewed, actionable catalogue keys only. Aggregated scores, timings, third-party
// errors, collection failures and arbitrary report text must never become tickets.
export const CHECKS = Object.freeze(Object.fromEntries(Object.entries({
  security: ['http.security.hsts', 'http.security.csp', 'http.security.x_frame_options',
    'http.security.x_content_type_options', 'http.security.referrer_policy',
    'http.security.permissions_policy', 'http.security.cookie_flags', 'http.final_url.https',
    'http.redirect.to_https', 'ssl.certificate.valid', 'ssl.certificate.expiry_days',
    'ssl.protocols.tls13', 'ssl.protocols.tls12', 'ssl.protocols.legacy_disabled',
    'tech.security.version_disclosure'],
  seo: ['http.headers.content_type', 'http.seo.robots_txt', 'http.seo.sitemap', 'html.title',
    'html.meta.description.present', 'html.link.canonical.present', 'html.h1.count',
    'html.social.meta', 'html.meta.robots.present', 'html.meta.charset.present'],
  a11y: ['html.meta.viewport.present', 'html.doctype.html5', 'html.images.alt_coverage',
    'html.anchors.href_coverage', 'html.lang'],
  performance: ['http.status_code', 'http.redirect.count', 'http.protocol.version',
    'http.protocol.http2', 'http.headers.compression', 'http.headers.caching',
    'runtime.console.errors', 'runtime.js.errors', 'runtime.network.5xx',
    'runtime.network.failed_requests', 'runtime.network.request_count', 'runtime.network.bytes_estimated'],
}).flatMap(([domain, keys]) => keys.map(key => [key, domain]))));

export class ControlError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export const requireControl = (condition, code) => { if (!condition) throw new ControlError(code); };

export function normalizeServices(value) {
  const selected = typeof value === 'string' ? [value] : value;
  requireControl(Array.isArray(selected) && selected.length > 0 && selected.length <= SERVICES.length
    && selected.every(service => SERVICES.includes(service))
    && new Set(selected).size === selected.length, 'configuration-invalid');
  return SERVICES.filter(service => selected.includes(service));
}

export function parseServices(value) {
  try { return normalizeServices(JSON.parse(value)); } catch { return null; }
}

export function analysisKey(deployment, sample, invocation) {
  const hex = createHash('sha256').update(JSON.stringify([POLICY, SITE, deployment, invocation, sample])).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** An exact, documented gap may not disqualify otherwise measured site checks. */
function abortedFetchTransferGap(report) {
  const checks = report?.scores?.coverage?.checks;
  if (!Array.isArray(checks) || checks.some(check => check?.state === 'MEASURED' && check.confidence !== 'MEASURED')) return false;
  const gaps = checks.filter(check => !['MEASURED', 'NOT_APPLICABLE'].includes(check?.state));
  const gap = gaps[0];
  if (gaps.length !== 1 || gap.key !== 'runtime.network.bytes_estimated' || gap.module !== 'runtime'
    || gap.domain !== 'performance' || gap.state !== 'UNAVAILABLE' || gap.reason !== 'CHECK_MISSING'
    || gap.confidence !== 'UNKNOWN') return false;
  const measurements = report?.measurements;
  const failed = measurements?.failedRequests;
  if (measurements?.transferredBytes !== null || !Number.isFinite(measurements?.loadMs) || measurements.loadMs < 0
    || !Number.isSafeInteger(failed) || failed < 1 || failed > 10
    || !Number.isSafeInteger(measurements.requests) || measurements.requests < failed) return false;
  const issue = (Array.isArray(report.issues) ? report.issues : []).find(item => item?.id === 'runtime.network.failed_requests' && item.categoryKey === 'performance');
  const observed = issue?.structuredEvidence?.observed;
  return issue?.structuredEvidence?.source === 'runtime'
    && issue.structuredEvidence.measurement?.value === failed
    && observed?.version === 'observed-evidence-v1' && observed.source === 'runtime' && observed.state === 'AVAILABLE'
    && observed.redacted === true && observed.truncated === false && observed.inspected === failed
    && Array.isArray(observed.items) && observed.items.length === failed
    && observed.items.every(item => item?.kind === 'resource' && item.reason === 'net::ERR_ABORTED'
      && item.resourceType === 'fetch' && item.ownership === 'FIRST_PARTY' && item.status == null);
}

/** Reconstruct fixed diagnostic codes only; never retain report prose, URLs or run IDs. */
export function collectionEvidence(report) {
  const modules = ['http', 'html', 'runtime', 'lighthouse', 'observatory', 'ssl', 'zap', 'tech'];
  const reasons = ['CHECK_MISSING', 'MODULE_MISSING', 'NAVIGATION_INCOMPLETE', 'POLICY_DISABLED',
    'PROVIDER_RATE_LIMITED', 'PROVIDER_AUTH_REQUIRED', 'PROVIDER_UNAVAILABLE', 'INTEGRATION_ENDPOINT',
    'NETWORK_DNS', 'NETWORK_CONNECT', 'NETWORK_TLS', 'DEADLINE_EXCEEDED', 'TARGET_ASSESSMENT_FAILED',
    'INVALID_RESPONSE', 'INCOMPLETE_MEASUREMENTS', 'INTEGRATION_FAILURE', 'SSL_ENDPOINTS_PARTIALLY_MEASURED',
    'HTTP_TRANSPORT_UNAVAILABLE', 'HTTP_CHALLENGE_OBSERVED', 'MEASUREMENT_SOURCE_MISSING', 'MEASUREMENT_MISSING'];
  const gaps = new Map();
  for (const check of (Array.isArray(report?.scores?.coverage?.checks) ? report.scores.coverage.checks.slice(0, 4096) : [])) {
    if (check?.state === 'NOT_APPLICABLE' || (check?.state === 'MEASURED' && check.confidence !== 'PARTIAL')) continue;
    const key = Object.hasOwn(CHECKS, check?.key) ? check.key : 'OTHER';
    const module = modules.includes(check?.module) ? check.module : 'UNKNOWN';
    const reason = reasons.includes(check?.reason) ? check.reason : 'UNKNOWN';
    gaps.set([key, module, reason].join(':'), { key, module, reason });
  }
  return {
    execution: Object.fromEntries(['total', 'completed', 'partial', 'failed', 'skipped', 'pending', 'running'].map(key => {
      const value = report?.scores?.moduleExecution?.[key];
      return [key, Number.isSafeInteger(value) && value >= 0 && value <= 32 ? value : null];
    })),
    gaps: [...gaps.values()].slice(0, 64),
  };
}

function measuredFindings(report) {
  const coverage = report?.scores?.coverage;
  const execution = report?.scores?.moduleExecution;
  requireControl(isHomepage(report?.pageIdentity?.requested)
    && isHomepage(report?.pageIdentity?.destination) && report.pageIdentity.redacted === false,
  'target-unverified');
  const complete = execution?.total > 0 && execution.completed === execution.total && execution.partial === 0;
  const transferGap = execution?.total === 8 && execution.completed === 7 && execution.partial === 1
    && abortedFetchTransferGap(report);
  requireControl((complete || transferGap)
    && ['failed', 'skipped', 'pending', 'running'].every(key => execution[key] === 0), 'collection-incomplete');
  requireControl(report.antiBot?.detected !== true && report.scores.globalAvailable === true
    && coverage?.provisional === false && coverage.global?.sufficient === true
    && coverage.global.ratio >= 0.8 && Array.isArray(coverage.domains)
    && DOMAINS.every(domain => coverage.domains.some(d => d.key === domain && d.sufficient === true && d.ratio >= 0.8))
    && Array.isArray(coverage.checks) && Array.isArray(report.issues), 'coverage-insufficient');
  const findings = new Map();
  for (const issue of report.issues) {
    if (!Object.hasOwn(CHECKS, issue.id) || CHECKS[issue.id] !== issue.categoryKey
      || !['critical', 'important'].includes(issue.severity) || issue.confidence === 'LOW') continue;
    if (!coverage.checks.some(check => check.key === issue.id && check.domain === issue.categoryKey
      && check.state === 'MEASURED' && check.confidence === 'MEASURED')) continue;
    // Reconstruct from the whitelist, never copy titles, recommendations or evidence.
    const finding = { key: issue.id, domain: CHECKS[issue.id], severity: issue.severity };
    if (findings.get(issue.id)?.severity !== 'critical') findings.set(issue.id, finding);
  }
  return findings;
}

export function evaluateReports(first, second) {
  const left = measuredFindings(first), right = measuredFindings(second);
  for (const key of ['scoringFingerprint', 'measurementFingerprint', 'scopeFingerprint']) {
    const value = first.scores.calculation?.[key];
    requireControl(typeof value === 'string' && value.length > 0 && value.length <= 512
      && value === second.scores.calculation?.[key], 'reports-incomparable');
  }
  const findings = [...right.values()].filter(item => left.has(item.key)).map(item => ({
    ...item, severity: item.severity === 'critical' && left.get(item.key).severity === 'critical' ? 'critical' : 'important',
  })).sort((a, b) => a.key.localeCompare(b.key));
  const limited = [first, second].some(report => report.scores.moduleExecution.partial > 0);
  return { outcome: findings.some(item => item.severity === 'critical') ? 'SITE_NO_GO' : 'GO', findings,
    ...(limited ? { limitations: [TRANSFER_LIMITATION] } : {}) };
}

export function ticketMarker(key) {
  requireControl(Object.hasOwn(CHECKS, key), 'finding-invalid');
  return `<!-- argos-self-audit:${TICKET_NAMESPACE}:${createHash('sha256').update(SITE + '/\n' + key).digest('hex')} -->`;
}

/** Validate and reconstruct at the write-permission boundary, discarding extra fields. */
export function ticketInput(evidence, expectedSha, service) {
  const selected = normalizeServices(service);
  requireControl(SHA.test(expectedSha)
    && evidence?.schemaVersion === 1 && evidence.policy === POLICY
    && evidence.expectedSha === expectedSha
    && JSON.stringify(normalizeServices(evidence.services ?? evidence.service)) === JSON.stringify(selected)
    && ['GO', 'SITE_NO_GO'].includes(evidence.outcome)
    && Array.isArray(evidence.findings) && evidence.findings.length <= Object.keys(CHECKS).length,
  'evidence-invalid');
  const findings = evidence.findings.map(item => {
    requireControl(Object.hasOwn(CHECKS, item.key) && CHECKS[item.key] === item.domain
      && ['critical', 'important'].includes(item.severity), 'evidence-invalid');
    return { key: item.key, domain: CHECKS[item.key], severity: item.severity };
  });
  requireControl(new Set(findings.map(item => item.key)).size === findings.length
    && (findings.some(item => item.severity === 'critical') ? 'SITE_NO_GO' : 'GO') === evidence.outcome,
  'evidence-invalid');
  return findings;
}
