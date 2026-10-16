// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import CoverageDetails from './CoverageDetails';
import { coverageBreakdown } from './coverageExplanation';
import type { Coverage } from './types';

const fixture: Coverage = { version:'weighted-coverage-v3', threshold:.8, provisional:false,
  global:{key:'global',measuredWeight:215,expectedWeight:223,ratio:215/223,available:true,sufficient:true}, domains:[],
  checks:[{key:'lighthouse.score.performance',domain:'performance',module:'lighthouse',weight:215,state:'MEASURED',reason:'CHECK_OBSERVED',confidence:'MEASURED',measurementModule:'lighthouse'},
    {key:'observatory.score',domain:'security',module:'observatory',weight:8,state:'UNAVAILABLE',reason:'MODULE_MISSING',confidence:'UNKNOWN'},
    {key:'http.redirect.to_https',domain:'security',module:'http',weight:2,state:'NOT_APPLICABLE',reason:'INPUT_ALREADY_HTTPS',confidence:'UNKNOWN'}] };
it('explains a rounded 96 using the frozen denominator and exclusions', () => {
  const before=structuredClone(fixture), result=coverageBreakdown(fixture);
  expect(result.reconciled).toBe(true);
  expect(result.points(8)).toBeCloseTo(3.587443946);
  render(<CoverageDetails coverage={fixture} lang="fr"/>);
  expect(screen.getByText('96 % mesurés — 4 % non couverts')).toBeInTheDocument();
  expect(screen.getByText(/3,59 points de couverture/)).toBeInTheDocument();
  expect(screen.getByText('observatory.score')).toBeInTheDocument();
  expect(screen.getByText(/Le module attendu est absent de cette analyse\./)).toBeInTheDocument();
  expect(fixture).toEqual(before);
});
it('retains partial sources without calling a partial measurement complete',()=>{
  const partial=structuredClone(fixture); partial.checks[0].confidence='PARTIAL'; partial.checks[0].measurementModule='zap';partial.checks[0].measurementSources=['http','zap'];
  render(<CoverageDetails coverage={partial} lang="en"/>);
  expect(screen.getByText(/Partial measurement/)).toBeInTheDocument();
  expect(screen.getByText(/Actual source: zap \(http, zap\)/)).toBeInTheDocument();
});
it('keeps unknown reasons private and explains incomplete historic breakdowns',()=>{
  const old=structuredClone(fixture);old.checks=old.checks.slice(1);old.checks[0].reason='https://private.example/?token=secret';
  const {container}=render(<CoverageDetails coverage={old} lang="en"/>);
  expect(container.textContent).toContain('does not fully reconcile');
  expect(container.textContent).not.toContain('private.example');
});
it('does not invent missing historical coverage',()=>{
  render(<CoverageDetails lang="fr"/>);expect(screen.getByText('Détail indisponible pour cette analyse.')).toBeInTheDocument();
});
