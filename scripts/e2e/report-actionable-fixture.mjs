import { createServer } from 'node:http';
import { lighthouseEvidence } from '../../apps/lighthouse-service/evidence.mjs';

// Run after the visual-review fixture on 3018, with Next API_BASE=http://127.0.0.1:3019.
// Synthetic data only. Real collector extraction is used for resource and DOM observations.
const upstream = 'http://127.0.0.1:3018';
const base = await (await fetch(upstream + '/api/reports/review-complete-fixture')).json();
const evidence = items => lighthouseEvidence({ details: { type: 'table', items } });
const findings = [
  { id: 'lighthouse.audit.font-display-insight', categoryKey: 'performance', severity: 'important',
    title: 'Font display', impact: 'Font display', recommendation: '', confidence: 'HIGH',
    structuredEvidence: { source: 'lighthouse', observed: evidence([
      { url: 'https://cdn.atelier.example/fonts/inter-latin.woff2', wastedMs: 180 },
    ]) } },
  { id: 'lighthouse.audit.image-delivery-insight', categoryKey: 'performance', severity: 'important',
    title: 'Improve image delivery', impact: 'Improve image delivery', recommendation: '', confidence: 'HIGH',
    structuredEvidence: { source: 'lighthouse', observed: evidence([
      { url: 'https://atelier.example/images/sac-coton.webp', totalBytes: 280000, wastedBytes: 185000,
        node: { type: 'node', path: '1,HTML,1,BODY,1,MAIN,2,IMG', selector: 'main > img.product-hero' } },
    ]) } },
  { id: 'lighthouse.audit.image-alt', categoryKey: 'a11y', severity: 'important',
    title: 'Image elements do not have alt attributes', impact: 'Missing alternative', recommendation: '', confidence: 'HIGH',
    structuredEvidence: { source: 'lighthouse', observed: evidence([
      { node: { type: 'node', path: '1,HTML,1,BODY,1,MAIN,2,IMG', selector: 'main > img.product-hero' } },
    ]) } },
];
const report = { ...base, access: 'full', issues: findings,
  summary: { oneLiner: 'fair', priorities: findings.map((issue, index) => ({
    findingKey: issue.id, title: issue.title, impact: issue.impact, severity: issue.severity,
    categoryKey: issue.categoryKey, rank: index + 1, rankReason: 'ZERO_GAIN_FOLLOWUP', confidence: 'HIGH',
  })) },
  diagnostics: { version: 'report-diagnostics-v1', scope: { kind: 'page', inspectedPages: 1, entireDomain: false }, checks: [
    ...findings.map(issue => ({ key: issue.id, domain: issue.categoryKey, source: 'lighthouse', title: issue.title, state: 'FINDING', findingKey: issue.id })),
    { key: 'http.status_code', domain: 'performance', source: 'http', title: 'Réponse HTTP reçue : 200', state: 'PASSED' },
    { key: 'ssl.grade', domain: 'security', source: 'ssl', title: 'Analyse TLS', state: 'UNAVAILABLE' },
    { key: 'http.redirect.to_https', domain: 'security', source: 'http', title: 'Redirection HTTP vers HTTPS', state: 'NOT_APPLICABLE' },
  ] },
};
report.scores = { ...base.scores, byCategory: base.scores.byCategory.map(category => ({
  ...category, issues: findings.filter(issue => issue.categoryKey === category.key).length,
})), coverage: { ...base.scores.coverage, provisional: true,
  global: { key: 'global', measuredWeight: 90, expectedWeight: 100, ratio: .9, available: true, sufficient: true },
  domains: base.scores.coverage.domains.map(domain => domain.key === 'security'
    ? { ...domain, measuredWeight: 0, expectedWeight: 10, ratio: 0, available: false, sufficient: false } : domain),
  checks: [{ key: 'ssl.grade', domain: 'security', module: 'ssl', weight: 10, state: 'UNAVAILABLE', reason: 'MODULE_MISSING', confidence: 'UNKNOWN' }],
} };

const otherFindings = [
  { id: 'lighthouse.audit.aria-dialog-name', module: 'lighthouse', categoryKey: 'a11y', title: 'Dialog has no accessible name',
    structuredEvidence: { source: 'lighthouse', observed: evidence([{ node: { type: 'node', selector: 'div.checkout-dialog', path: '1,HTML,1,BODY,3,DIV' } }]) } },
  { id: 'http.security.csp', module: 'http', categoryKey: 'security', title: 'CSP header missing' },
  { id: 'html.title', module: 'html', categoryKey: 'seo', title: 'Empty title', structuredEvidence: { source: 'html', details: [{ key: 'length', text: '0' }] } },
  { id: 'runtime.network.failed_requests', module: 'runtime', categoryKey: 'performance', title: 'Failed requests', structuredEvidence: { source: 'runtime', measurement: { value: 2, unit: 'count' } } },
  { id: 'ssl.certificate.expiry_days', module: 'ssl', categoryKey: 'security', title: 'Certificate expiry', structuredEvidence: { source: 'ssl', measurement: { value: 12, unit: 'days' } } },
  { id: 'observatory.score', module: 'observatory', categoryKey: 'security', title: 'Observatory score', recommendation: 'Content-Security-Policy header not implemented.', structuredEvidence: { source: 'observatory', measurement: { value: 50, unit: 'score/100' }, details: [{ key: 'failedPolicies', text: '[content-security-policy]' }] } },
  { id: 'tech.security.version_disclosure', module: 'tech', categoryKey: 'security', title: 'Version disclosure' },
  { id: 'zap.alert.10098', module: 'zap', categoryKey: 'security', title: 'Cross-Domain Misconfiguration', recommendation: 'Restrict Access-Control-Allow-Origin to the origins required by this application.', structuredEvidence: { source: 'zap', details: [{ key: 'description', text: 'The response can be read from an unintended origin.' }, { key: 'solution', text: 'Restrict Access-Control-Allow-Origin to the origins required by this application.' }] } },
  { id: 'zap.alert.90003', module: 'zap', categoryKey: 'security', title: 'Historical ZAP rule without retained solution' },
].map(value => ({ severity: 'important', impact: '', recommendation: '', confidence: 'HIGH', ...value }));
const guidanceFindings = [...findings, ...otherFindings];
const guidanceReport = { ...report, issues: guidanceFindings,
  scores: { ...base.scores, byCategory: base.scores.byCategory.map(category => ({ ...category, issues: guidanceFindings.filter(issue => issue.categoryKey === category.key).length })) },
  diagnostics: { ...report.diagnostics, checks: guidanceFindings.map(issue => ({ key: issue.id, domain: issue.categoryKey, source: issue.module ?? 'lighthouse', title: issue.title, state: 'FINDING', findingKey: issue.id })) },
};

createServer(async (req, res) => {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const pathname = new URL(req.url, upstream).pathname;
  if (pathname === '/api/reports/review-actionable-fixture') {
    res.end(JSON.stringify(report)); return;
  }
  if (pathname === '/api/reports/review-guidance-fixture') {
    res.end(JSON.stringify(guidanceReport)); return;
  }
  try {
    const response = await fetch(upstream + req.url);
    res.statusCode = response.status;
    res.end(await response.text());
  } catch { res.writeHead(502).end('{}'); }
}).listen(3019, '127.0.0.1', () => console.log('Actionable Lighthouse fixture API on 127.0.0.1:3019'));
