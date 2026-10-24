import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './changed-paths.mjs';

const enabled = paths => Object.entries(classify(paths)).filter(([,run]) => run).map(([name]) => name).sort();
const all = Object.keys(classify(null)).sort();
const cases = [
  ['portable client, bundle or provider template', ['clients/ci/src/client.mjs'], all],
  ['documentation only', ['README.md','docs/testing/ci.md','apps/api-backend/README.md'], []],
  ['frontend code', ['apps/console-web/src/app/page.tsx'], ['frontend','e2e','auth']],
  ['frontend unit tests', ['apps/console-web/src/components/AuditForm.dom.test.tsx'], ['frontend']],
  ['backend code', ['apps/api-backend/src/main/java/Example.java'], ['api','integration','e2e','auth']],
  ['backend unit tests', ['apps/api-backend/src/test/java/ScoreServiceTest.java'], ['api']],
  ['database integration tests', ['apps/api-backend/src/test/java/UsageIT.java'], ['api','integration']],
  ['shared database fixture', ['apps/api-backend/src/test/java/MariaDbReportFixture.java'], ['api','integration','e2e','auth']],
  ['audit integration harness', ['apps/api-backend/src/test/java/ControlledAuditE2eIT.java'], ['api','integration','e2e']],
  ['runtime collector', ['apps/playwright-service/app.mjs'], ['playwright','e2e','security']],
  ['runtime unit tests', ['apps/playwright-service/app.test.mjs'], ['playwright']],
  ['lighthouse lockfile', ['apps/lighthouse-service/package-lock.json'], ['lighthouse','e2e','security','dependency_lighthouse']],
  ['browser dependency used by auth', ['apps/playwright-service/package.json'], ['playwright','e2e','auth','security','dependency_playwright']],
  ['browser security configuration', ['infra/compose/playwright-service/chromium-seccomp.json'], ['security']],
  ['egress fixture', ['scripts/security/fixture.mjs'], ['security']],
  ['egress policy', ['apps/audit-egress/proxy.mjs'], ['security','e2e']],
  ['authentication browser harness', ['scripts/e2e/auth-experience.mjs'], ['auth']],
  ['audit browser harness', ['scripts/e2e/browser.mjs'], ['e2e']],
  ['visual harness only', ['scripts/e2e/connected-analysis.mjs'], []],
  ['visual manifest helper', ['scripts/e2e/acceptance-evidence.mjs'], ['frontend']],
  ['visual workflow only', ['.github/workflows/visual-regression.yml'], []],
  ['deployment routing', ['scripts/ci/deploy-paths.mjs'], ['frontend']],
  ['deployment workflow', ['.github/workflows/deploy.yml'], ['frontend']],
  ['post-deployment workflow', ['.github/workflows/post-deploy-audit.yml'], ['frontend']],
  ['coverage investigation helper', ['scripts/explain-coverage.mjs'], ['frontend']],
  ['frozen coverage fixture', ['docs/report/fixtures/coverage-production-a.json'], ['frontend']],
  ['contracts', ['scripts/contracts/generate-connected.py'], ['api','frontend','integration','e2e','auth']],
];
for (const [name,paths,expected] of cases) test(name + ' selects only affected checks', () => {
  assert.deepEqual(enabled(paths),expected.sort());
});

test('shared routing changes and explicit full runs exercise all checks', () => {
  for (const paths of [['.github/workflows/ci.yml'],['.github/action-pins.json'],['scripts/ci/changed-paths.mjs'],null]) assert.deepEqual(enabled(paths),all);
});

test('multiple changed components combine their consumers', () => {
  assert.deepEqual(enabled(['apps/console-web/src/app/page.tsx','apps/playwright-service/app.test.mjs']),['auth','e2e','frontend','playwright']);
});

test('CLI uses merge-base for PRs, before..after for pushes, full manual runs, and dependency-only scheduled runs', () => {
  const root=mkdtempSync(join(tmpdir(),'argos-ci-paths-'));
  const script=fileURLToPath(new URL('./changed-paths.mjs',import.meta.url));
  const output=join(root,'result.txt');
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const save=path=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),'fixture');};
  const commit=message=>{git('add','.');git('-c','user.name=CI fixture','-c','user.email=ci@example.invalid','commit','-m',message);return git('rev-parse','HEAD');};
  const run=(event,base,head)=>{
    writeFileSync(output,'');
    const result=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',env:{...process.env,GITHUB_EVENT_NAME:event,GITHUB_OUTPUT:output,BASE_SHA:base,HEAD_SHA:head}});
    return {result,selected:readFileSync(output,'utf8').trim().split('\n').filter(line=>line.endsWith('=true')).map(line=>line.split('=')[0]).sort()};
  };
  try {
    git('init','--initial-branch=main');save('README.md');const initial=commit('initial');
    save('apps/console-web/src/app/page.tsx');const base=commit('base changed frontend');
    git('checkout','-b','feature',initial);save('apps/api-backend/src/main/java/Example.java');const head=commit('feature changed backend');
    const pr=run('pull_request',base,head);assert.equal(pr.result.status,0,pr.result.stderr);
    assert.deepEqual(pr.selected,['api','auth','e2e','integration']);
    const push=run('push',base,head);assert.equal(push.result.status,0,push.result.stderr);
    assert.deepEqual(push.selected,['api','auth','e2e','frontend','integration'],'A removed frontend file must also select its consumers');
    assert.deepEqual(run('workflow_dispatch','','').selected,all);
    assert.deepEqual(run('schedule','','').selected,['dependency_frontend','dependency_lighthouse','dependency_playwright']);
    assert.deepEqual(run('push','0'.repeat(40),head).selected,all);
    assert.notEqual(run('pull_request','',head).result.status,0,'Invalid diffs must fail so jobs take their full fallback');
    assert.notEqual(run('push','not-a-revision',head).result.status,0,'A failed Git comparison must not silently skip checks');
  } finally { rmSync(root,{recursive:true,force:true}); }
});
