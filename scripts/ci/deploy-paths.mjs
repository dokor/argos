import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { changedPaths } from './changed-paths.mjs';
import { SERVICES } from './self-audit-policy.mjs';

export function deploymentServices(paths, requested = 'all') {
  if (!['all', ...SERVICES].includes(requested)) throw new Error('Unknown deployment service');
  if (requested !== 'all') return [requested];
  return SERVICES.filter(service => paths === null || paths.some(path =>
    path.startsWith(`apps/${service}/`) || path.startsWith(`infra/compose/${service}/`)
    || (service !== 'console-web' && path.startsWith('apps/audit-egress/'))
    || path === '.github/workflows/deploy.yml' || path === 'scripts/ci/deploy-paths.mjs'));
}

if (process.env.GITHUB_OUTPUT && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const services = deploymentServices(changedPaths(), process.env.DEPLOY_SERVICE || 'all');
  appendFileSync(process.env.GITHUB_OUTPUT, `services=${JSON.stringify(services)}\n`);
}
