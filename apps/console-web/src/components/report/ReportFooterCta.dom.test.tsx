// @vitest-environment jsdom
import { describe,it,expect,vi,beforeEach } from 'vitest';
import { render,screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LangProvider } from '@/lib/i18n/LangContext';
import ReportFooterCta from './ReportFooterCta';
import { reportShareUrl,validContact } from './reportSharing';
beforeEach(()=>{vi.restoreAllMocks();window.history.replaceState(null,'','/en/report/fixture-private?view=technical&domain=seo&severity=important&extra=discard#finding-61');});
describe('private sharing',()=>{
 it('keeps language and validated reading state, excludes arbitrary parameters',()=>{
  expect(reportShareUrl(window.location.href)).toBe(window.location.origin+'/en/report/fixture-private?view=technical&domain=seo&severity=important#finding-61');
  expect(()=>reportShareUrl('https://argos.invalid/exemple-rapport')).toThrow();
 });
 it('rejects invalid destinations, credentials and mail payloads',()=>{
  for(const value of ['#','javascript:alert(1)','http://calendly.com/test','https://user:pass@example.com','mailto:a@example.com?body=secret','mailto:a@example.com%0A'])expect(validContact(value)).toBeUndefined();
  expect(validContact('mailto:a@example.com')).toBe('mailto:a@example.com');
 });
 for(const lang of ['fr','en'] as const) it('announces copy success and failure '+lang,async()=>{
  const user=userEvent.setup(); const write=vi.spyOn(navigator.clipboard,'writeText').mockResolvedValue(undefined);
  render(<LangProvider initialLang={lang}><ReportFooterCta contactUrl=""/></LangProvider>);
  const button=screen.getByRole('button',{name:lang==='fr'?'Copier le lien':'Copy link'});
  await user.click(button); expect(write).toHaveBeenCalledTimes(1);expect(write.mock.calls[0][0]).toContain('/en/report/fixture-private?view=technical');
  expect(screen.getByRole('status')).toHaveTextContent(lang==='fr'?'Lien copié':'Link copied');
  write.mockRejectedValue(new Error('denied')); await user.click(button);
  expect(screen.getByRole('status')).toHaveTextContent(lang==='fr'?'Copie impossible':'Could not copy');
  expect(screen.queryByRole('link',{name:lang==='fr'?'Parler des corrections':'Discuss the corrections'})).not.toBeInTheDocument();
 });
 it('shows only a usable configured contact without attaching a report',()=>{
  render(<LangProvider><ReportFooterCta contactUrl="mailto:a@example.com"/></LangProvider>);
  expect(screen.getByRole('link',{name:'Parler des corrections'})).toHaveAttribute('href','mailto:a@example.com');
 });
});
