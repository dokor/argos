// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { LangProvider } from '@/lib/i18n/LangProvider';
import { demoReport } from '@/components/marketing/reportDemoFixture';
import IssuesByCategory from './IssuesByCategory';
import ReportChecks from './ReportChecks';
import { findingContent } from './findingCatalogue';
import { buildReportModel, findingAnchor } from './reportModel';
import { resolveReading } from './reportReading';
import { ReportLink } from '@/components/connected/domains/DomainUi';
import type { PageResult } from '@/lib/connected/contracts';

for (const lang of ['fr', 'en'] as const) it(`finds a diagnosis by its affected file and clears an empty search in ${lang}`, async () => {
  const report = demoReport(lang), user = userEvent.setup();
  report.issues[0] = { id: 'lighthouse.audit.font-display-insight', title: 'Font display', categoryKey: 'performance',
    severity: 'important', impact: '', recommendation: '', structuredEvidence: { source: 'lighthouse', observed: {
      version: 'observed-evidence-v1', source: 'lighthouse', state: 'AVAILABLE', inspected: 2, truncated: false, redacted: true,
      items: [{ kind: 'resource', origin: 'https://cdn.example', resourceRef: '0123456789abcdef', resourcePath: '/fonts/inter.woff2', metrics: { wastedMs: 180 } }],
    } } };
  const before = JSON.stringify(report);
  const { container } = render(<LangProvider initialLang={lang}><IssuesByCategory report={report}/></LangProvider>);
  const search = screen.getByRole('searchbox', { name: lang === 'fr' ? 'Rechercher un problème ou une ressource' : 'Find a problem or resource' });
  await user.type(search, 'inter.woff2');
  expect(container.querySelectorAll('details[id^="finding-"]')).toHaveLength(1);
  await user.click(screen.getByText(findingContent(report.issues[0], lang).title, { exact: true }));
  expect(screen.getByText('https://cdn.example/fonts/inter.woff2')).toBeVisible();
  expect(screen.getByText('180 ms')).toBeVisible();
  await user.clear(search);
  await user.type(search, 'unmatched-file');
  expect(container.querySelectorAll('details[id^="finding-"]')).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: lang === 'fr' ? 'Afficher tous les constats' : 'Show all findings' }));
  expect(container.querySelectorAll('details[id^="finding-"]').length).toBe(report.issues.length);
  expect(JSON.stringify(report)).toBe(before);
});

it('shows unmeasured checks separately with a reason, and lists successes only on request', async () => {
  const report = demoReport('fr'), user = userEvent.setup();
  report.diagnostics = { version: 'report-diagnostics-v1', scope: { kind: 'page', inspectedPages: 1, entireDomain: false }, checks: [
    { key: 'ssl.grade', domain: 'security', source: 'ssl', title: 'Analyse TLS', state: 'UNAVAILABLE' },
    { key: 'http.status_code', domain: 'performance', source: 'http', title: 'Réponse HTTP : 200', state: 'PASSED' },
  ] };
  report.scores.coverage!.checks = [{ key: 'ssl.grade', domain: 'security', module: 'ssl', weight: 1, state: 'UNAVAILABLE', reason: 'MODULE_MISSING', confidence: 'UNKNOWN' }];
  render(<LangProvider><ReportChecks report={report}/></LangProvider>);
  await user.click(screen.getByText('Contrôles réussis et limites de l’analyse'));
  expect(screen.getByText('Analyse TLS')).toBeVisible();
  expect(screen.getByText(/Le module attendu est absent/)).toBeVisible();
  expect(screen.queryByText('Réponse HTTP : 200')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Réussis · 1' }));
  expect(screen.getByText('Réponse HTTP : 200')).toBeVisible();
});

it('opens the same finding from a domain page link without losing the return route', () => {
  const report = demoReport('fr'), key = report.issues[0].id!, returnTo = '/account/domains/1/batches/2?rule=' + key;
  render(<LangProvider><ReportLink page={{ runId: '17', reportAvailable: true, normalizedUrl: 'https://example.com/product' } as PageResult} returnTo={returnTo} ruleKey={key}/></LangProvider>);
  const url = new URL(screen.getByRole('link').getAttribute('href')!, 'https://argos.invalid');
  expect(url.searchParams.get('returnTo')).toBe(returnTo);
  expect(url.hash).toBe('#' + findingAnchor(key));
  expect(resolveReading(url.search + url.hash, buildReportModel(report)).finding?.key).toBe(key);
});
