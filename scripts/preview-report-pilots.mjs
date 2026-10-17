import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// Local, fictional, read-only review material. Never point this process at production data.
const cases = JSON.parse(readFileSync(new URL('../apps/console-web/src/components/report/fixtures/pilot-findings.json', import.meta.url), 'utf8'));
const selections = {
  baseline: ['titleShort', 'images', 'cspAbsent', 'lcp'],
  limits: ['titleMissing', 'images', 'cspUnrecognised', 'lcpRatioOnly'],
  source: ['titleLong', 'images', 'zapCsp', 'lcpDiscovery'],
  breakdown: ['titleShort', 'images', 'cspEmpty', 'lcpBreakdown'],
  historical: ['titleShort', 'images', 'cspAbsent', 'lcpRatioOnly'],
  partial: ['titleShort', 'images', 'cspAbsent', 'lcpRatioOnly'],
};
export function pilotReport(variant = 'baseline') {
  const issues = structuredClone((selections[variant] ?? selections.baseline).map(key => cases[key]));
  if (variant === 'historical') for (const issue of issues) delete issue.structuredEvidence.detection;
  const partial = variant === 'partial';
  const categories = ['performance', 'security', 'seo', 'a11y'];
  const aggregate = key => ({ key, measuredWeight: partial ? 60 : 100, expectedWeight: 100,
    ratio: partial ? .6 : 1, available: true, sufficient: !partial });
  return {
    access: 'full', generatedAt: '2026-10-17T12:00:00Z', domain: 'pilot.example',
    url: 'https://pilot.example/collection/exemple', site: { title: 'Fiches pilotes — données fictives / Fictional pilot findings' },
    pageIdentity: { requested: 'https://pilot.example/collection/exemple', destination: 'https://pilot.example/collection/exemple', redacted: false, redirected: false },
    introduction: { author: 'Fixture de revue / Review fixture', context: 'Données entièrement fictives. Aucune mesure de production ni validation humaine. / Entirely fictional data. No production measurement or human validation.', nextStep: 'Lire les quatre constats / Read the four findings', findingKeys: issues.map(i => i.id), publishedAt: '2026-10-17T12:00:00Z' },
    scores: { global: 62, globalAvailable: true, completeness: partial ? 60 : 100,
      byCategory: categories.map(key => ({ key, label: key, score: 62, issues: issues.filter(i => i.categoryKey === key).length })),
      coverage: { version: 'pilot-fixture', threshold: .8, provisional: partial, global: aggregate('global'), domains: categories.map(aggregate), checks: [] } },
    ...(partial ? { antiBot: { detected: true, vendor: 'Fictional challenge' } } : {}),
    summary: { oneLiner: 'fair', priorities: issues.map((i,index) => ({ findingKey: i.id, categoryKey: i.categoryKey, title: i.title, impact: i.impact, severity: 'important', rank: index + 1, confidence: 'HIGH' })) },
    issues,
  };
}

const port = Number(process.env.PILOT_API_PORT ?? 3028);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid fixture port');
createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  const send = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)); };
  if (request.method !== 'GET') return send(405, { error: 'Read-only fictional fixtures' });
  const url = new URL(request.url, 'http://127.0.0.1');
  const match = /^\/api\/(?:account\/reports\/|reports\/)(review-pilots-(baseline|limits|source|breakdown|historical|partial))$/.exec(url.pathname);
  if (match) return send(200, pilotReport(match[2]));
  if (url.pathname === '/api/account/me') return send(401, { error: 'session_invalid' });
  return send(404, {});
}).listen(port, '127.0.0.1', () => console.log(`Fictional pilot fixtures: http://127.0.0.1:${port} (GET only)`));
