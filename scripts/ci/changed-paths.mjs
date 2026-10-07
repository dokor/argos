import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const event = process.env.GITHUB_EVENT_NAME;
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;

function changedPaths() {
  // Release evidence expects every check on the deployed main revision.
  if (event === 'workflow_dispatch' || event === 'push') return null;
  if (event !== 'pull_request') {
    throw new Error(`Unsupported event: ${event}`);
  }
  if (!base || !head || /^0+$/.test(base)) {
    throw new Error('A valid base and head SHA are required');
  }
  const range = `${base}...${head}`;
  return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', range], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

export function classify(paths) {
  const all = paths === null;
  const matches = (predicate) => all || paths.some(predicate);
  const starts = (prefix) => (path) => path.startsWith(prefix);
  const common = matches((path) =>
    path.startsWith('scripts/ci/') ||
    path.startsWith('.github/actions/') ||
    path.startsWith('.github/workflows/')
  );
  const api = common || matches(starts('apps/api-backend/'));
  const frontend = common || matches((path) =>
    path.startsWith('apps/console-web/') ||
    path.startsWith('scripts/release/') ||
    path.startsWith('scripts/check-release-evidence') ||
    path === 'scripts/verify-ci-failures.mjs'
  );
  const playwright = common || matches((path) =>
    path.startsWith('apps/playwright-service/') || path === 'scripts/verify-ci-failures.mjs'
  );
  const lighthouse = common || matches((path) =>
    path.startsWith('apps/lighthouse-service/') || path === 'scripts/verify-ci-failures.mjs'
  );
  const dependency = (app) => common || matches((path) =>
    path === `apps/${app}/package.json` ||
    path === `apps/${app}/package-lock.json` ||
    path === `apps/${app}/.npmrc` ||
    path === '.npmrc'
  );
  return {
    api,
    frontend,
    playwright,
    lighthouse,
    e2e: common || matches((path) => path.startsWith('apps/') || path.startsWith('scripts/e2e/')),
    dependency_frontend: dependency('console-web'),
    dependency_playwright: dependency('playwright-service'),
    dependency_lighthouse: dependency('lighthouse-service'),
  };
}

if (process.env.GITHUB_OUTPUT) {
  const result = classify(changedPaths());
  for (const [name, enabled] of Object.entries(result)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${enabled}\n`);
  }
}
