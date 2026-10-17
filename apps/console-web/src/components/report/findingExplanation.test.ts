import { describe, expect, it } from 'vitest';
import cases from './fixtures/pilot-findings.json';
import { findingExplanation, recordedPilotDetection, pilotFindingKeys } from './findingExplanation';
import { findingContent } from './findingCatalogue';
import type { Issue } from './types';

const fixtures = cases as Record<keyof typeof cases, Issue>;

describe('four pilot families: frozen detection and actionable explanations', () => {
  for (const lang of ['fr', 'en'] as const) {
    it(`uses recorded facts and bounds without changing the finding in ${lang}`, () => {
      const before = structuredClone(fixtures);
      for (const key of pilotFindingKeys) {
        const issue = Object.values(fixtures).find(i => i.id === key)!;
        const explanation = findingExplanation(issue, lang);
        expect(explanation.methodNote).toContain(issue.structuredEvidence!.detection!.ruleVersion);
        expect(explanation.steps.length).toBeGreaterThanOrEqual(3);
        expect(findingContent(issue, lang).recommendation.length).toBeLessThan(explanation.steps.join(' ').length);
        expect(new URL(explanation.reference!).protocol).toBe('https:');
        expect(explanation.verifiedAt).toBe('2026-10-17');
      }
      const customBounds = structuredClone(fixtures.titleShort);
      customBounds.structuredEvidence!.detection!.values.minimum = 12;
      expect(findingExplanation(customBounds, lang).detection).toContain('12');
      expect(findingExplanation(fixtures.lcp, lang).methodNote).toContain('13.5.0');
      expect(fixtures).toEqual(before);
    });

    it(`distinguishes absent, short and long titles in ${lang}`, () => {
      const findings = [fixtures.titleMissing, fixtures.titleShort, fixtures.titleLong].map(i => findingContent(i, lang));
      expect(new Set(findings.map(c => c.title)).size).toBe(3);
      expect(findings[0].observation).toContain('0');
      expect(findings[1].observation).toContain('3');
      expect(findings[2].observation).toContain('81');
      expect(findingExplanation(fixtures.titleShort, lang).reference).toContain('/title-link');
    });

    it(`reports missing alt attributes without claiming to know image purpose or location in ${lang}`, () => {
      const content = findingContent(fixtures.images, lang);
      expect(content.observation).toContain('3'); expect(content.observation).toContain('18');
      expect(content.missingInformation).toContain(lang === 'fr' ? 'emplacement exact' : 'exact image locations');
      expect(content.title).not.toContain(lang === 'fr' ? 'informatives' : 'informative');
      expect(findingExplanation(fixtures.images, lang).expected).toContain(lang === 'fr' ? 'Une personne' : 'A person');
    });

    it(`keeps CSP absence, an unrecognised policy and a ZAP observation distinct in ${lang}`, () => {
      const absent = findingContent(fixtures.cspAbsent, lang), unrecognised = findingContent(fixtures.cspUnrecognised, lang);
      expect(absent.title).toContain(lang === 'fr' ? 'absent' : 'absent');
      expect(unrecognised.observation).toContain(lang === 'fr' ? 'présent' : 'present');
      expect(unrecognised.title).not.toBe(absent.title);
      expect(findingContent(fixtures.cspEmpty, lang).observation).toContain(lang === 'fr' ? 'vide' : 'empty');
      const zap = findingExplanation(fixtures.zapCsp, lang);
      expect(zap.detection).toContain('ZAP'); expect(zap.methodNote).not.toContain('http-csp-v1');
      const contaminated = structuredClone(fixtures.zapCsp);
      contaminated.structuredEvidence!.detection = fixtures.cspAbsent.structuredEvidence!.detection;
      expect(recordedPilotDetection(contaminated)).toBeUndefined();
      expect(findingContent(contaminated, lang).title).not.toBe(absent.title);
    });

    it(`never labels a score or an insight saving as total LCP in ${lang}`, () => {
      expect(findingContent(fixtures.lcp, lang).observation.replaceAll(/[\s,]/g, '')).toContain('3800ms');
      const absent = findingContent(fixtures.lcpRatioOnly, lang).observation;
      expect(absent).toContain(lang === 'fr' ? 'durée est indisponible' : 'duration is unavailable');
      expect(absent).not.toContain('0.2 ms');
      for (const issue of [fixtures.lcpDiscovery, fixtures.lcpBreakdown]) {
        const content = findingContent(issue, lang);
        expect(content.observation).not.toContain(lang === 'fr' ? 'LCP mesuré' : 'LCP measurement');
        expect(findingExplanation(issue, lang).detection).toContain(lang === 'fr' ? 'durée totale LCP' : 'total LCP duration');
      }
      expect(findingExplanation(fixtures.lcpDiscovery, lang).steps).not.toEqual(findingExplanation(fixtures.lcpBreakdown, lang).steps);
    });

    it(`keeps historical, missing, future and malformed methods explicit in ${lang}`, () => {
      const issue = structuredClone(fixtures.titleShort);
      delete issue.structuredEvidence!.detection;
      const missing = findingExplanation(issue, lang);
      expect(missing.methodNote).toContain(lang === 'fr' ? 'indisponible' : 'unavailable');
      expect(missing.detection).not.toMatch(/\b10\b|\b80\b/);
      issue.structuredEvidence!.detection = { ...fixtures.titleShort.structuredEvidence!.detection!, ruleVersion: 'html-title-v999' };
      expect(recordedPilotDetection(issue)).toBeUndefined();
      expect(findingExplanation(issue, lang).methodNote).not.toContain('html-title-v1.');
      issue.structuredEvidence!.detection = structuredClone(fixtures.titleShort.structuredEvidence!.detection!);
      issue.structuredEvidence!.detection!.values.length = Number.NaN;
      expect(recordedPilotDetection(issue)).toBeUndefined();
      issue.structuredEvidence!.detection!.values.length = 81; // Inconsistent with SHORT.
      expect(recordedPilotDetection(issue)).toBeUndefined();
    });
  }
});
