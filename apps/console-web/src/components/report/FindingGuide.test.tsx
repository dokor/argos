// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect,it } from 'vitest';
import FindingGuide from './FindingGuide';
import PrintableReport from './PrintableReport';
import FindingDetails from './FindingDetails';
import { LangProvider } from '@/lib/i18n/LangContext';
import { findingContent, cleanEvidence } from './findingCatalogue';
import { findingPlaybook, rulePlaybooks } from './findingPlaybooks';
import historical from './fixtures/historical-report.json';
import type { Issue,Report } from './types';
const issue:Issue={id:'html.images.alt_coverage',categoryKey:'a11y',severity:'important',title:'Images',impact:'',recommendation:'',structuredEvidence:{source:'html',details:[{key:'imgCount',text:'4'},{key:'imgAltMissingCount',text:'2'}]}};
it('uses actual producer field names and keeps fictional code separate from observations',()=>{
  expect(findingContent(issue,'fr').observation).toBe('2 image(s) sans attribut alt parmi 4 images observées.');
  const {container}=render(<FindingGuide issue={issue} lang="fr"/>);
  expect(container.textContent).toContain('Exemple fictif à adapter');expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toContain('revue humaine');
});
it('shares exact guide text and references between web and full PDF in both languages',()=>{
  for(const lang of ['fr','en'] as const){
    const finding={key:issue.id!,anchor:'test',domain:'a11y' as const,issue,sources:['html']};
    const web=render(<LangProvider initialLang={lang}><FindingDetails finding={finding}/></LangProvider>);
    const pdf=render(<PrintableReport report={{...historical,issues:[issue]} as Report} lang={lang} format="full"/>);
    expect(web.container.querySelector('[data-finding-guide]')?.textContent).toBe(pdf.container.querySelector('[data-finding-guide]')?.textContent);
    web.unmount();pdf.unmount();
  }
});
it('provides bilingual detection, concrete steps, expected result and limits or explicit missing fields',()=>{
  for(const key of Object.keys(rulePlaybooks))for(const lang of ['fr','en'] as const){const p=findingPlaybook(key,lang);expect(p.steps.length).toBeGreaterThan(1);expect(p.expected.length).toBeGreaterThan(20);expect(p.detection.length).toBeGreaterThan(20);expect(p.limits).toBeTruthy();expect(new URL(p.reference!).protocol).toBe('https:');}
  expect(findingPlaybook('lighthouse.audit.future-rule','fr').limits).toContain('Détail indisponible');
  expect(findingPlaybook('zap.alert.12345','en').detection).toContain('ZAP');
  expect(findingPlaybook(null,'en').specific).toBe(false);
});
it('redacts report credentials and secret assignments without converting an audit ratio into a duration',()=>{
  expect(cleanEvidence('https://example.com/report/abcdefghijklmnopqrstuvwxyz?x=secret token=abc')).not.toContain('abcdefghijklmnopqrstuvwxyz');
  expect(cleanEvidence('password=abc')).not.toContain('abc');
  expect(findingContent({...issue,id:'lighthouse.audit.largest-contentful-paint',structuredEvidence:{source:'lighthouse',details:[{key:'score',text:'0.02'}]}},'en').observation).not.toContain('0.02 ms');
});
