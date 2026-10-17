import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { SITE, requireControl, normalizeServices, parseServices, ticketInput, ticketMarker } from './self-audit-policy.mjs';

const END = '<!-- /argos-self-audit -->';
export function ticketBody(finding, sha, service, runId) {
  return [ticketMarker(finding.key), '## Contrôle Argos après déploiement', '',
    `Constat \`${finding.key}\` confirmé par deux analyses comparables de ${SITE}/.`,
    `Domaine : **${finding.domain}**. Sévérité confirmée : **${finding.severity}**.`, '',
    `Services déployés : ${normalizeServices(service).map(name => '\`' + name + '\`').join(', ')}. Révision observée : \`${sha}\`.`,
    `[Contrôle et preuve filtrée](https://github.com/dokor/argos/actions/runs/${runId}).`, '',
    'Vérifier le contrôle indiqué, corriger sa cause puis confirmer sur le prochain audit.',
    'Les preuves détaillées restent dans le compte CI Argos ; aucun lien porteur de token n’est publié.',
    'Origine : #94. La fermeture est manuelle ; une récidive rouvre ce même ticket.', END].join('\n');
}

export async function synchronizeTickets({ evidence, sha, service, services = service, runId, api }) {
  requireControl(typeof runId === 'string' && /^[1-9][0-9]{0,19}$/.test(runId), 'configuration-invalid');
  const findings = ticketInput(evidence, sha, services);
  if (!findings.length) return { created: 0, updated: 0 };
  const existing = [];
  // List state=all rather than eventually-consistent search. If pagination is
  // incomplete, fail closed instead of risking a duplicate creation.
  for (let page = 1; ; page++) {
    const issues = await api('GET', `/issues?state=all&per_page=100&page=${page}`);
    requireControl(Array.isArray(issues), 'github-response-invalid');
    existing.push(...issues.filter(issue => !issue.pull_request && issue.user?.login === 'github-actions[bot]'));
    if (issues.length < 100) break;
    requireControl(page < 20, 'github-pagination-limit');
  }
  const result = { created: 0, updated: 0 };
  for (const finding of findings) {
    const marker = ticketMarker(finding.key);
    const matches = existing.filter(issue => typeof issue.body === 'string' && issue.body.includes(marker));
    requireControl(matches.length <= 1, 'ticket-duplicates-exist');
    const issue = matches[0];
    const block = ticketBody(finding, sha, services, runId);
    if (!issue) {
      await api('POST', '/issues', { title: `[Auto-audit] ${finding.key}`, body: block });
      result.created++;
      continue;
    }
    requireControl(Number.isSafeInteger(issue.number) && issue.number > 0, 'github-response-invalid');
    const start = issue.body.indexOf(marker), end = issue.body.indexOf(END, start);
    requireControl(end >= start, 'ticket-marker-invalid');
    const body = issue.body.slice(0, start) + block + issue.body.slice(end + END.length);
    if (body !== issue.body || issue.state !== 'open') {
      await api('PATCH', `/issues/${issue.number}`, { body, state: 'open' });
      result.updated++;
    }
  }
  return result;
}

export function githubApi(token, { fetcher = fetch, wait = sleep } = {}) {
  requireControl(Boolean(token), 'configuration-invalid');
  return async (method, path, body) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetcher('https://api.github.com/repos/dokor/argos' + path, {
          method, redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        // Never retry an ambiguous creation: the next workflow lists all issues
        // and recovers the marker before trying to create again.
        requireControl(method === 'GET' && attempt < 2, 'github-transport-failed');
      }
      if ((!response || response.status >= 500) && method === 'GET' && attempt < 2) {
        await response?.body?.cancel(); await wait(1000 * 2 ** attempt); continue;
      }
      requireControl(response?.ok, 'github-request-failed');
      try { return await response.json(); } catch { throw new Error('github-response-invalid'); }
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const raw = readFileSync('outputs/post-deploy-audit.json', 'utf8');
    requireControl(raw.length <= 65536, 'evidence-invalid');
    const result = await synchronizeTickets({ evidence: JSON.parse(raw), sha: process.env.EXPECTED_SHA,
      services: parseServices(process.env.DEPLOYED_SERVICES), runId: process.env.GITHUB_RUN_ID, api: githubApi(process.env.GH_TOKEN) });
    console.log(JSON.stringify(result));
  } catch { console.error('Ticket synchronization failed; inspect the filtered control artifact and retry.'); process.exitCode = 2; }
}
