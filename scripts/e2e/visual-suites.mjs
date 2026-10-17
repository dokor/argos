import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Each script owns a distinct output directory, so artifacts can be merged safely.
export const groups = {
  public: ['connected-cleanup', 'public-header', 'account-history', 'connected-shell', 'connected-evidence'],
  analysis: ['connected-analysis', 'connected-analysis-recovery', 'connected-overview'],
  account: ['connected-account', 'connected-usage', 'connected-admin', 'admin-analytics'],
  domains: ['connected-domains'],
};

export function runGroup(name, run = spawnSync) {
  if (!Object.hasOwn(groups, name)) throw new Error('Unknown visual group: ' + name);
  for (const suite of groups[name]) {
    console.log('Visual suite: ' + suite);
    const result = run(process.execPath, ['scripts/e2e/' + suite + '.mjs'], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.signal || result.status === null) throw new Error(suite + ' terminated without a result');
    if (result.status !== 0) return result.status;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = runGroup(process.argv[2]);
