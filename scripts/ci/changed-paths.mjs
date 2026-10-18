import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function changedPaths(env = process.env) {
  const { GITHUB_EVENT_NAME: event, BASE_SHA: base, HEAD_SHA: head } = env;
  // Explicit certification and scheduled dependency scans always run in full.
  if (event === 'workflow_dispatch' || event === 'schedule') return null;
  if (!['pull_request', 'push'].includes(event)) throw new Error('Unsupported event: ' + event);
  // First push has no previous revision; inspect everything instead of guessing.
  if (event === 'push' && (!base || /^0+$/.test(base))) return null;
  if (!base || !head || /^0+$/.test(base)) throw new Error('A valid base and head SHA are required');
  const range = base + (event === 'pull_request' ? '...' : '..') + head;
  return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', range], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
}

const documentation = path => /(^|\/)docs\//.test(path) || /\.md$/.test(path);
const unitTest = path => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
  || /(^|\/)(__tests__|tests?)\//.test(path);

export function classify(paths) {
  const matches = predicate => paths === null || paths.some(predicate);
  const common = matches(path => path.startsWith('clients/ci/') && !documentation(path)
    || (path.startsWith('scripts/ci/') && !path.startsWith('scripts/ci/deploy-paths'))
    || path.startsWith('.github/actions/') || path === '.github/workflows/ci.yml' || path === '.github/action-pins.json');
  const component = app => matches(path => path.startsWith('apps/' + app + '/') && !documentation(path));
  const production = app => matches(path => path.startsWith('apps/' + app + '/')
    && !documentation(path) && !unitTest(path) && !path.includes('/src/test/')
    && !/\/(vitest|eslint)\.[^/]+$/.test(path));
  const contracts = matches(path => path.startsWith('scripts/contracts/')
    || path === 'apps/api-backend/src/main/resources/contracts/connected-space.openapi.json');
  const npmConfig = matches(path => path === '.npmrc');
  const dependency = app => matches(path => ['package.json', 'package-lock.json', '.npmrc']
    .some(file => path === 'apps/' + app + '/' + file));
  const backendProduction = production('api-backend') || contracts;
  // Shared Java fixtures/resources can affect several integration harnesses.
  const backendFixtures = matches(path => path.startsWith('apps/api-backend/src/test/')
    && !documentation(path) && (!path.endsWith('.java') || (!path.endsWith('Test.java') && !path.endsWith('IT.java'))));
  const frontendProduction = production('console-web') || contracts || npmConfig;
  const visualScript = path => /^scripts\/e2e\/(connected-|account-history\.|public-header\.|acceptance-evidence|visual-suites)/.test(path);
  const auditScripts = matches(path => path.startsWith('scripts/e2e/') && !visualScript(path)
    && !path.endsWith('.test.mjs') && path !== 'scripts/e2e/auth-experience.mjs');

  return {
    api: common || contracts || component('api-backend'),
    frontend: common || contracts || npmConfig || component('console-web')
      || matches(path => path.startsWith('scripts/release/') || path.startsWith('scripts/check-release-evidence')
        || path.startsWith('scripts/explain-coverage') || /^docs\/report\/fixtures\/coverage-.*\.json$/.test(path)
        || path.startsWith('scripts/e2e/acceptance-evidence') || path.startsWith('scripts/e2e/visual-suites')
        || path.startsWith('scripts/ci/deploy-paths') || path === '.github/workflows/deploy.yml'
        || path === '.github/workflows/post-deploy-audit.yml'),
    playwright: common || npmConfig || component('playwright-service'),
    lighthouse: common || npmConfig || component('lighthouse-service'),
    integration: common || backendProduction || backendFixtures
      || matches(path => path.startsWith('apps/api-backend/src/test/') && path.endsWith('IT.java')),
    e2e: common || backendProduction || backendFixtures || frontendProduction
      || production('playwright-service') || production('lighthouse-service') || production('audit-egress')
      || auditScripts || matches(path => path.endsWith('/ControlledAuditE2eIT.java')),
    auth: common || backendProduction || backendFixtures || frontendProduction
      || dependency('playwright-service') || matches(path => path === 'scripts/e2e/auth-experience.mjs'),
    security: common || npmConfig || component('audit-egress')
      || production('playwright-service') || production('lighthouse-service')
      || matches(path => path.startsWith('scripts/security/') || /^infra\/compose\/(audit-egress|playwright-service|lighthouse-service)\//.test(path)),
    dependency_frontend: common || npmConfig || dependency('console-web'),
    dependency_playwright: common || npmConfig || dependency('playwright-service'),
    dependency_lighthouse: common || npmConfig || dependency('lighthouse-service'),
  };
}

export function selectChecks(paths, event) {
  const checks = classify(paths);
  // The daily run discovers newly disclosed vulnerabilities without rebuilding
  // or retesting applications whose source has not changed.
  if (event === 'schedule') {
    for (const name of Object.keys(checks)) checks[name] = name.startsWith('dependency_');
  }
  return checks;
}

if (process.env.GITHUB_OUTPUT && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = selectChecks(changedPaths(), process.env.GITHUB_EVENT_NAME);
  for (const [name, enabled] of Object.entries(result)) appendFileSync(process.env.GITHUB_OUTPUT, name + '=' + enabled + '\n');
}
