import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/console-web/package.json',import.meta.url)),yaml=require('js-yaml');
const reference=new yaml.Type('!reference',{kind:'sequence',construct:value=>({reference:value})}),schema=yaml.DEFAULT_SCHEMA.extend([reference]);
const catalog=JSON.parse(readFileSync(new URL('../../apps/console-web/src/lib/ci-integration-templates.json',import.meta.url),'utf8'));
test('the web GitHub preview really grants read-only issues and passes the r SAS expected by the client',()=>{
  const base=yaml.load(catalog.templates.github),preview=yaml.load(catalog.templates.githubPreview);
  assert.deepEqual(preview.jobs.argos_control,base.jobs.argos_control,'Control and ciphertext provenance stay unchanged');
  const publisher=preview.jobs.argos_publish;
  assert.deepEqual(publisher.permissions,{actions:'read',issues:'read'});
  assert.equal(publisher.if,base.jobs.argos_publish.if);assert.deepEqual(publisher.concurrency,base.jobs.argos_publish.concurrency);
  const step=publisher.steps.find(s=>s.run==='node argos-ci.mjs publish-github');
  assert.equal(step.env.ARGOS_GITHUB_JOURNAL_READ_SAS_URL,'${{ secrets.ARGOS_GITHUB_JOURNAL_READ_SAS_URL }}');
  assert.equal(step.env.ARGOS_GITHUB_JOURNAL_SAS_URL,undefined);assert.equal(step.env.ARGOS_API_KEY,undefined);
  assert.deepEqual(publisher.steps.filter(s=>s.uses),base.jobs.argos_publish.steps.filter(s=>s.uses),'Action pins and encrypted artifact download stay unchanged');
});
test('the web GitLab preview uses a separate environment and strips privileged process credentials',()=>{
  const base=yaml.load(catalog.templates.gitlabPublication,{schema}),preview=yaml.load(catalog.templates.gitlabPreview,{schema});
  assert.deepEqual(preview.argos_control,base.argos_control);assert.deepEqual(preview.default,base.default);assert.deepEqual(preview.variables,base.variables);
  assert.equal(preview.argos_publish.environment.name,'argos-publisher-preview');
  assert.equal(preview.argos_publish.script.at(-1),'env -u ARGOS_API_KEY -u ARGOS_GITLAB_PUBLISH_TOKEN -u ARGOS_GITLAB_JOURNAL_SAS_URL node argos-ci.mjs publish-gitlab');
  assert.deepEqual(preview.argos_publish.rules,base.argos_publish.rules);assert.deepEqual(preview.argos_publish.dependencies,['argos_control']);
  assert.deepEqual(preview['.argos_download'],base['.argos_download'],'Client URL, checksum, runtime and TLS stay unchanged');
});
