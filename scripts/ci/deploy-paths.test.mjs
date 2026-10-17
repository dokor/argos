import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentServices } from './deploy-paths.mjs';
import { SERVICES } from './self-audit-policy.mjs';

test('a push deploys each affected service once, including compose changes', () => {
  assert.deepEqual(deploymentServices(['apps/console-web/src/app/page.tsx']), ['console-web']);
  assert.deepEqual(deploymentServices(['apps/api-backend/pom.xml', 'infra/compose/api-backend/docker-compose.prod.yml',
    'apps/console-web/Dockerfile']), ['api-backend', 'console-web']);
  assert.deepEqual(deploymentServices(['docs/testing/ci.md', 'scripts/ci/self-audit.test.mjs']), []);
  assert.deepEqual(deploymentServices(['infra/compose/lighthouse-service/chromium-seccomp.json']), ['lighthouse-service']);
});

test('shared egress changes deploy its three consumers', () => {
  assert.deepEqual(deploymentServices(['apps/audit-egress/proxy.mjs']), ['api-backend', 'playwright-service', 'lighthouse-service']);
});

test('manual full redeploys, deployment harness changes and a first push select all services', () => {
  for (const paths of [null, ['.github/workflows/deploy.yml'], ['scripts/ci/deploy-paths.mjs']]) {
    assert.deepEqual(deploymentServices(paths), SERVICES);
  }
  assert.deepEqual(deploymentServices(null, 'console-web'), ['console-web']);
  assert.throws(() => deploymentServices(null, '../../outside'), /Unknown deployment service/);
});
