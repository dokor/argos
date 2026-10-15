import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import PrintableReport from './PrintableReport';
import {demoReport} from '@/components/marketing/reportDemoFixture';
import {loadExportReport,exportTitle} from './reportExportData';
import historical from './fixtures/historical-report.json';
import type {Report} from './types';
import {findingContent} from './findingCatalogue';
describe('PDF contract',()=>{
 for(const lang of ['fr','en'] as const) it('shares titles, observations, verification and published introduction '+lang,()=>{
  const report=demoReport(lang);report.introduction={author:'Provider fixture',context:'Human context fixture',nextStep:'Review the selected evidence',findingKeys:report.issues.slice(0,2).map(i=>i.id!),publishedAt:'2026-10-13T10:00:00Z'};
  const html=renderToStaticMarkup(<PrintableReport report={report} lang={lang} format="full"/>);
  for(const issue of report.issues){const c=findingContent(issue,lang);for(const field of [c.title,c.observation,c.verification])expect(html).toContain(field.replaceAll('<','&lt;').replaceAll('>','&gt;'));}
  expect(html).toContain('Human context fixture');expect(html).toContain('Provider fixture');
  expect(html).not.toContain('/account');
 });
 for(const lang of ['fr','en'] as const) it('exports every unique finding independently from filters '+lang,()=>{
  const html=renderToStaticMarkup(<PrintableReport report={historical as Report} lang={lang} format="full"/>);
  expect((html.match(/id="finding-/g)||[])).toHaveLength(6);
  expect(html).toContain(lang==='fr'?'Domaine non renseigné':'Domain not provided');
  expect(html).toContain(lang==='fr'?'Comment vérifier':'How to verify');
  expect(html).not.toContain('/report/');
 });
 it('keeps provisional coverage and limitations in summary, without findings details',()=>{
  const html=renderToStaticMarkup(<PrintableReport report={demoReport('fr',true)} lang="fr" format="summary"/>);
  expect(html).toContain('Score provisoire');expect(html).toContain('50 %');expect(html).toContain('ne certifie');expect(html).not.toContain('id="finding-');
 });
 it('never exports inaccessible or invalid report responses',async()=>{
  for(const status of [404,410,500])await expect(loadExportReport('fixture-private',vi.fn().mockResolvedValue(new Response('{}',{status})))).rejects.toThrow('Export unavailable');
  const request=vi.fn();await expect(loadExportReport('../secret',request)).rejects.toThrow();expect(request).not.toHaveBeenCalled();
 });
 it('checks access without cache and uses only a generic filename',async()=>{
  const request=vi.fn().mockResolvedValue(Response.json(demoReport('fr')));await loadExportReport('fixture-private',request);
  expect(request).toHaveBeenCalledWith('/api/reports/fixture-private',{cache:'no-store',credentials:'same-origin',redirect:'error'});
  expect(exportTitle('full','2026-10-11T10:00:00Z')).toBe('Argos-full-2026-10-11');expect(exportTitle('summary','bad token')).toBe('Argos-summary-report');
 });
});
