// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LangProvider } from '@/lib/i18n/LangContext';
import FindingDetails from './FindingDetails';
import PrintableReport from './PrintableReport';
import { findingContent } from './findingCatalogue';
import { findingExplanation } from './findingExplanation';
import { findingPlaybook, playbookGroups } from './findingPlaybooks';
import historical from './fixtures/historical-report.json';
import type { Issue, Report } from './types';

const keys = ['font-display-insight', 'image-delivery-insight', 'cache-insight', 'render-blocking-insight', 'render-blocking-resources'];
function sections(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('[data-finding-guide-section]')]
    .map(section => [section.dataset.findingGuideSection,
      section.matches('[data-finding-guide-content]') ? section.textContent : section.querySelector('[data-finding-guide-content]')?.textContent])
    .sort(([a], [b]) => a!.localeCompare(b!));
}

it('does not shadow a playbook when separating blocking resources from unused code', () => {
  const allKeys = playbookGroups.flatMap(group => group.keys);
  expect(new Set(allKeys).size).toBe(allKeys.length);
  expect(findingPlaybook('lighthouse.audit.render-blocking-insight', 'en').detection)
    .not.toBe(findingPlaybook('lighthouse.audit.unused-javascript', 'en').detection);
});

for (const lang of ['fr', 'en'] as const) for (const id of keys) {
  it(`preserves evidence, historical uncertainty and web/PDF content for ${id} in ${lang}`, () => {
    const issue: Issue = { id: `lighthouse.audit.${id}`, categoryKey: 'performance', severity: 'important',
      title: 'Original tool title', impact: '', recommendation: '', confidence: 'HIGH',
      structuredEvidence: { source: 'lighthouse', details: [{ key: 'score', text: '0.2' }] } };
    const before = structuredClone(issue);
    const guide = findingExplanation(issue, lang);
    expect(guide.specific).toBe(true);
    expect(guide.methodNote).toContain(lang === 'fr' ? 'historique' : 'historical');
    expect(findingContent(issue, lang).observation).not.toContain('0.2 ms');
    expect(findingContent(issue, lang).qualification).toBe(lang === 'fr' ? 'Signal à vérifier sur le parcours' : 'Signal to verify in the journey');
    expect(findingContent({ ...issue, structuredEvidence: undefined }, lang).observation)
      .toContain(lang === 'fr' ? 'non conservée' : 'not retained');
    const web = render(<LangProvider initialLang={lang}><FindingDetails finding={{ key: issue.id!, anchor: 'insight', domain: 'performance', issue, sources: ['lighthouse'] }}/></LangProvider>);
    const pdf = render(<PrintableReport report={{ ...historical, issues: [issue] } as Report} lang={lang} format="full"/>);
    expect(sections(web.container)).toEqual(sections(pdf.container));
    expect(web.container.querySelector('[data-finding-guide-section="reference"] a')?.getAttribute('href')).toBe(guide.reference);
    if (guide.example) {
      expect(web.container.querySelector('figcaption')?.textContent).toContain(lang === 'fr' ? 'fictif' : 'Fictional');
      expect(web.container.querySelector('pre code')?.textContent).toBe(guide.example);
      expect(web.container.querySelector('script')).toBeNull();
    }
    expect(issue).toEqual(before);
    web.unmount(); pdf.unmount();
  });
}
