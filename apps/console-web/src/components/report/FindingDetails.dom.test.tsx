// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LangProvider } from '@/lib/i18n/LangContext';
import FindingDetails from './FindingDetails';
import { reportReadingCopy } from './reportReadingCopy';
import type { Finding } from './reportModel';
import type { Issue } from './types';

const issue: Issue = {
  id: 'lighthouse.audit.font-display-insight', categoryKey: 'performance', severity: 'critical',
  title: 'Affichage de la police', impact: 'Affichage de la police', recommendation: '', confidence: 'UNKNOWN',
  evidence: 'Source evidence token=private-value',
  structuredEvidence: { source: 'lighthouse', details: [{ key: 'category', text: 'performance' }, { key: 'score', text: '0.0' }, { key: 'weight', text: '0' }],
    observed: { version: 'observed-evidence-v1', source: 'lighthouse', state: 'AVAILABLE', inspected: 3, truncated: false, redacted: true,
      items: ['1111111111111111', '2222222222222222', '3333333333333333'].map(resourceRef => ({ kind: 'resource', origin: 'https://fonts.gstatic.com/', resourceRef })) },
  },
};
const finding: Finding = { key: issue.id!, anchor: 'finding-font', domain: 'performance', sources: ['lighthouse'], issue };

for (const lang of ['fr', 'en'] as const) describe(`finding questions in ${lang}`, () => {
  it('opens the observation and keeps four independent question previews with all evidence reachable', async () => {
    const user = userEvent.setup(), copy = reportReadingCopy[lang], questions = copy.findingQuestions;
    const before = JSON.stringify(issue);
    const { container } = render(<LangProvider initialLang={lang}><FindingDetails finding={finding}/></LangProvider>);
    const titleText = (title: string) => screen.getByText(title.replaceAll('\u00a0', ' '), { exact: true });
    const disclosure = (title: string) => titleText(title).closest('details')!;
    expect(disclosure(questions.observation).open).toBe(true);
    expect(disclosure(questions.impact).open).toBe(false);
    expect(disclosure(questions.action).open).toBe(false);
    expect(disclosure(questions.verification).open).toBe(false);
    expect(screen.getByText(questions.resourcesMany.replace('{n}', '3'))).toBeVisible();
    expect(within(disclosure(questions.observation)).getByText(copy.unknownConfidence)).toBeVisible();
    expect(within(disclosure(questions.observation)).getByText(copy.missingMeasure)).toBeVisible();
    expect(screen.getByText(issue.id!)).not.toBeVisible();

    await user.click(titleText(questions.action));
    expect(disclosure(questions.action).open).toBe(true);
    expect(disclosure(questions.observation).open).toBe(true);
    expect(within(disclosure(questions.action)).getByRole('list')).toBeVisible();
    await user.click(titleText(questions.verification));
    expect(disclosure(questions.verification).querySelector('[data-finding-guide-section="verification"]')).toBeVisible();
    await user.click(screen.getByText(questions.evidence, { exact: true }));
    for (const item of issue.structuredEvidence!.observed!.items) expect(screen.getByText(item.resourceRef!)).toBeVisible();
    expect(screen.getByText(issue.id!)).toBeVisible();
    expect(screen.getByText(copy.lighthouseRatio)).toBeVisible();
    expect(screen.getByText('0.0')).toBeVisible();
    expect(screen.queryByText('0 ms')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('private-value');
    expect(container.querySelector('[data-finding-guide-section="detection"]')).toBeVisible();
    expect(container.querySelector('[data-finding-guide-section="reference"] a')).toBeVisible();
    expect(JSON.stringify(issue)).toBe(before);
  });

  it('retains the complete technical detail list and valid zero measurements', async () => {
    const user = userEvent.setup(), copy = reportReadingCopy[lang];
    const measured: Issue = { ...issue, structuredEvidence: { source: 'runtime', measurement: { value: 0, unit: 'ms' }, details: Array.from({ length: 24 }, (_, i) => ({ key: `detail-${i}`, text: `value-${i}` })) } };
    render(<LangProvider initialLang={lang}><FindingDetails finding={{ ...finding, issue: measured }}/></LangProvider>);
    expect(screen.getByText('0 ms')).toBeVisible();
    expect(screen.queryByText(copy.missingMeasure)).not.toBeInTheDocument();
    await user.click(screen.getByText(copy.findingQuestions.evidence, { exact: true }));
    expect(screen.getByText('value-23')).toBeVisible();
    expect(screen.getByText(/Source evidence/)).toBeVisible();
  });

  it('does not interpret an empty or unavailable sample as no affected elements', async () => {
    const user = userEvent.setup(), copy = reportReadingCopy[lang];
    const missing: Issue = { ...issue, structuredEvidence: { source: 'lighthouse', observed: { ...issue.structuredEvidence!.observed!, state: 'UNAVAILABLE', items: [] } } };
    render(<LangProvider initialLang={lang}><FindingDetails finding={{ ...finding, issue: missing }}/></LangProvider>);
    expect(screen.queryByText(copy.findingQuestions.resourcesMany.replace('{n}', '0'))).not.toBeInTheDocument();
    await user.click(screen.getByText(copy.findingQuestions.evidence, { exact: true }));
    expect(screen.getByText(lang === 'fr' ? /Cela ne signifie pas qu’aucun élément/ : /This does not mean that no element/)).toBeVisible();
  });
});
