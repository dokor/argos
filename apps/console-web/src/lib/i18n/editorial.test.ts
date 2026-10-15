import { describe, expect, it } from 'vitest';
import fr from './fr.json';
import en from './en.json';
import { copy as admin } from '@/components/admin/copy';
import { historyCopy } from '@/components/account/historyCopy';
import { feedbackCopy } from '@/components/feedback/copy';
import { reportReadingCopy } from '@/components/report/reportReadingCopy';
import { decisionCopy } from '@/components/report/decisionCopy';

function strings(value: unknown, prefix = '', result: Record<string, string> = {}) {
  if (typeof value === 'string') result[prefix] = value;
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) strings(child, `${prefix}.${key}`, result);
  return result;
}

describe('FR/EN editorial contracts', () => {
  for (const [name, pair] of Object.entries({ dictionaries: { fr, en }, admin, historyCopy, feedbackCopy, reportReadingCopy, decisionCopy })) {
    it(`${name}: preserves keys and interpolation variables`, () => {
      const a = strings(pair.fr), b = strings(pair.en);
      expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
      for (const key of Object.keys(a)) {
        expect(a[key].trim(), key).not.toBe('');
        expect(b[key].trim(), key).not.toBe('');
        expect((a[key].match(/\{\w+\}/g) ?? []).sort(), key).toEqual((b[key].match(/\{\w+\}/g) ?? []).sort());
      }
    });
  }
});
