import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import lighthouse from './lighthouseAuditCatalogue.json';
import { findingPlaybook } from './findingPlaybooks';
import { findingContent, supportedFindingKeys } from './findingCatalogue';
import { expectsScalarMeasurement, findingExplanation } from './findingExplanation';
import type { Issue } from './types';

const issue: Issue = { severity: 'important', title: 'Source title', impact: '', recommendation: '', confidence: 'HIGH' };
it('covers every potentially publishable rule of the pinned Lighthouse configuration in both languages', () => {
  for (const id of Object.keys(lighthouse.audits)) for (const lang of ['fr', 'en'] as const) {
    const key = `lighthouse.audit.${id}`;
    expect(findingPlaybook(key, lang).specific, `${key}: missing correction in ${lang}`).toBe(true);
    expect(supportedFindingKeys, `${key}: missing explanation in ${lang}`).toContain(key);
    expect(findingContent({ ...issue, id: key }, lang).title).not.toBe('Source title');
  }
});
it('covers static findings from every Java collector, including TLS, technology and ZAP aliases', () => {
  const root = new URL('../../../../api-backend/src/main/java/com/dokor/argos/services/analysis/modules/', import.meta.url);
  const files = readdirSync(root, { recursive: true }).filter(name => String(name).endsWith('Analyzer.java'));
  const keys = files.flatMap(name => [...readFileSync(new URL(String(name).replaceAll('\\', '/'), root), 'utf8')
    .matchAll(/"((?:http|html|runtime|ssl|observatory|zap|tech)\.[a-z0-9_.-]+)"/g)].map(match => match[1]));
  // These producer keys describe inventory/metadata, never actionable findings.
  const informational = new Set(['observatory.grade', 'observatory.tests.passed', 'zap.scan.result', 'zap.alert.',
    'tech.cms', 'tech.frontend.framework', 'tech.frontend.nextjs', 'tech.backend.hints', 'tech.cdn.cloudflare',
    'tech.http.server_header', 'tech.analysis.duration_ms']);
  for (const key of new Set(keys)) if (!informational.has(key)) for (const lang of ['fr', 'en'] as const) {
    expect(findingPlaybook(key, lang).specific, key).toBe(true);
    expect(supportedFindingKeys, key).toContain(key);
  }
});
it('keeps distinct TLS remedies and correct image semantics', () => {
  const expiry = findingExplanation({ ...issue, id: 'ssl.certificate.expiry_days' }, 'fr');
  const legacy = findingExplanation({ ...issue, id: 'ssl.protocols.legacy_disabled' }, 'fr');
  expect(expiry.steps.join(' ')).toContain('Renouveler');
  expect(legacy.steps.join(' ')).toContain('Désactiver');
  expect(findingExplanation({ ...issue, id: 'lighthouse.audit.image-size-responsive' }, 'fr').steps.join(' ')).toContain('devicePixelRatio');
});
it('never labels an observed DOM location as an absent measurement', () => {
  const content = findingContent({ ...issue, id: 'lighthouse.audit.aria-dialog-name', structuredEvidence: {
    source: 'lighthouse', observed: { version: 'observed-evidence-v1', source: 'lighthouse', state: 'AVAILABLE', inspected: 1, truncated: false, redacted: false,
      items: [{ kind: 'element', selector: 'div.checkout-dialog' }] },
  } }, 'fr');
  expect(content.observation).toContain('1 élément(s)');
  expect(content.observation).not.toContain('non conservée');
  for (const id of ['zap.alert.10098', 'http.security.hsts', 'ssl.certificate.valid', 'html.lang', 'tech.security.version_disclosure'])
    expect(expectsScalarMeasurement({ ...issue, id }), id).toBe(false);
  expect(expectsScalarMeasurement({ ...issue, id: 'runtime.network.failed_requests' })).toBe(true);
});
it('retains the source explanation and solution for dynamic ZAP rules, safely and without inventing missing guidance', () => {
  const zap = { ...issue, id: 'zap.alert.10098', structuredEvidence: { source: 'zap', details: [
    { key: 'description', text: 'Cross-origin responses allow unintended readers.' },
    { key: 'solution', text: 'Restrict Access-Control-Allow-Origin to trusted origins. token=private' },
  ] } };
  for (const lang of ['fr', 'en'] as const) {
    const explanation = findingExplanation(zap, lang);
    expect(explanation.specific).toBe(true);
    expect(explanation.observation).toContain('unintended readers');
    expect(explanation.steps.join(' ')).toContain('Access-Control-Allow-Origin');
    expect(explanation.steps.join(' ')).not.toContain('private');
    expect(explanation.reference).toBe('https://www.zaproxy.org/docs/alerts/10098/');
    expect(findingExplanation({ ...zap, id: 'zap.alert.90003', structuredEvidence: undefined, recommendation: 'Examinez et corrigez ce problème de sécurité : alerte' }, lang).specific).toBe(false);
  }
});
it('surfaces actual failed Observatory policies and preserves their source description', () => {
  const value = findingExplanation({ ...issue, id: 'observatory.score', recommendation: 'CSP lacks frame-ancestors.',
    structuredEvidence: { source: 'observatory', details: [{ key: 'failedPolicies', text: '[content-security-policy]' }] } }, 'fr');
  expect(value.observation).toContain('content-security-policy');
  expect(value.steps.join(' ')).toContain('frame-ancestors');
});
