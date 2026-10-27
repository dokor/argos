// @vitest-environment jsdom
import { render, screen } from "@/test/render";
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { LangProvider } from '@/lib/i18n/LangProvider';
import WebTip from './WebTip';
import { selectWebTip, webTips } from './webTips';
it('has 50 bilingual, dated, sourced entries with stable unique IDs',()=>{
  expect(webTips.length).toBeGreaterThanOrEqual(50);expect(new Set(webTips.map(t=>t.id)).size).toBe(webTips.length);
  for(const tip of webTips){expect(tip.translations.fr).toBeTruthy();expect(tip.translations.en).toBeTruthy();expect(new URL(tip.sourceUrl).protocol).toBe('https:');expect(tip.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);}
});
it('filters missing language, disabled and expired entries and handles empty/singleton catalogues',()=>{
  const tip=webTips[0];expect(selectWebTip([], 'fr')).toBeUndefined();expect(selectWebTip([{...tip,active:false}], 'fr')).toBeUndefined();
  expect(selectWebTip([{...tip,translations:{fr:'bonjour'}}], 'en')).toBeUndefined();
  expect(selectWebTip([{...tip,validUntil:'2020-01-01'}], 'fr')).toBeUndefined();
  expect(selectWebTip([tip],'fr',tip.id)).toBe(tip);
  expect(selectWebTip(webTips,'fr',tip.id,()=>0)?.id).not.toBe(tip.id);
});
it('has an identical empty SSR slot, then keeps one tip across rerenders and preference changes',()=>{
  expect(renderToString(<LangProvider initialLang="fr"><WebTip/></LangProvider>)).not.toContain('<aside');
  const random=vi.spyOn(Math,'random');
  const {rerender}=render(<LangProvider initialLang="fr"><WebTip/></LangProvider>);
  const text=screen.getByRole('complementary').textContent, calls=random.mock.calls.length;
  rerender(<LangProvider initialLang="fr"><WebTip/></LangProvider>);
  expect(screen.getByRole('complementary').textContent).toBe(text);expect(random.mock.calls.length).toBe(calls);
  expect(screen.getByRole('link')).toHaveAttribute('referrerpolicy','no-referrer');random.mockRestore();
});
