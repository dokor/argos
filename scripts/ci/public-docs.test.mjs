import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { install, firstAudit, admissionCurl, journal, request, checksum } from '../../apps/console-web/src/components/docs/content.ts';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8').replaceAll('\r\n','\n');
test('public OpenAPI and account templates are exact reviewed contracts in the standalone frontend context',()=>{
  for(const script of ['sync-ci-public-docs','sync-ci-integration-templates'])execFileSync(process.execPath,[fileURLToPath(new URL('scripts/contracts/'+script+'.mjs',root)),'--check']);
  const source=JSON.parse(read('docs/ci/openapi-v1.json'));
  assert.deepEqual(source,JSON.parse(read('apps/console-web/public/docs/openapi-v1.json')));
  assert.deepEqual(source.security,[{argosCiApiKey:[]}]);
  for(const methods of Object.values(source.paths))for(const op of Object.values(methods))assert.notDeepEqual(op.security,[]);
});
test('copied shell and journal examples parse without execution; distribution digest and admission shape match',()=>{
  const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
  for(const input of [install,firstAudit,admissionCurl])execFileSync(bash,['-n'],{input});
  execFileSync(process.execPath,['--input-type=module','--check'],{input:journal});
  assert.equal(createHash('sha256').update(readFileSync(new URL('clients/ci/dist/argos-ci.mjs',root))).digest('hex'),checksum);
  assert.deepEqual(JSON.parse(request),{url:'https://example.com',samples:2,profileId:'standard-v1'});
  assert.ok(admissionCurl.includes('--config -'));assert.ok(admissionCurl.includes('${ARGOS_IDEMPOTENCY_KEY:?}'));
  assert.ok(admissionCurl.includes('--fail-with-body'),'A rejected admission must fail the copied curl command');
  assert.ok(firstAudit.includes('set -eu'),'Do not continue a copied example after failed doctor or audit');
});
test('installation pins match the source distribution, templates, and publication configuration stays disabled',()=>{
  const content=read('apps/console-web/src/components/docs/content.ts'),catalog=JSON.parse(read('apps/console-web/src/lib/ci-integration-templates.json'));
  const revision=content.match(/export const revision="([a-f0-9]{40})"/)[1],checksum=content.match(/export const checksum="([a-f0-9]{64})"/)[1];
  for(const template of Object.values(catalog.templates)){assert.ok(template.includes(revision));assert.ok(template.includes(checksum));assert.ok(template.includes('24.21.0'));}
  for(const config of Object.values(catalog.publication)){assert.equal(config.mode,'DISABLED');assert.equal(config.reopenResolved,false);assert.equal(config.allowPrivateDetails,false);assert.equal(config.allowPublicNotice,false);}
  assert.ok(content.includes('set -eu'));assert.ok(content.includes('ARGOS_CI_OPERATION=resume'));
  assert.ok(!content.includes('/api/v1/ci/'));
});
