import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const require = createRequire(new URL('../../apps/console-web/package.json', import.meta.url));
const yaml = require('js-yaml'); // Existing locked frontend dev dependency; none in the distributed client.
const reference = new yaml.Type('!reference', { kind: 'sequence', construct: value => ({ reference: value }) });
const schema = yaml.DEFAULT_SCHEMA.extend([reference]);
const read = name => readFileSync(new URL('../../clients/ci/templates/' + name, import.meta.url), 'utf8');
const githubText = read('github-actions.yml'), gitlabText = read('gitlab-ci.yml'), publicationText = read('gitlab-publication.yml');
const github = yaml.load(githubText), gitlab = yaml.load(gitlabText, { schema }), publication = yaml.load(publicationText, { schema });
const pins = JSON.parse(readFileSync(new URL('../../.github/action-pins.json', import.meta.url), 'utf8'));
const bundle = readFileSync(new URL('../../clients/ci/dist/argos-ci.mjs', import.meta.url));
const checksum = createHash('sha256').update(bundle).digest('hex');

test('both provider templates parse and pin the exact standalone bytes, Node and all actions without running project code', () => {
  for (const text of [githubText, gitlabText, publicationText]) {
    const urls = [...text.matchAll(/https:\/\/raw\.githubusercontent\.com\/dokor\/argos\/([a-f0-9]{40})\/clients\/ci\/dist\/argos-ci.mjs/g)];
    assert.ok(urls.length); assert.ok(urls.every(u => u[1] === urls[0][1]));
    assert.ok(text.includes(checksum + '  argos-ci.mjs')); assert.match(text, /24\.21\.0/);
    assert.match(text, /--proto '=https' --tlsv1\.2/); assert.match(text, /--max-time 30 --max-redirs 0/);
    const code = text.split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n');
    assert.doesNotMatch(code, /curl[^\n]+\|\s*(?:bash|sh)|npm\s+(?:install|ci)|pull_request_target|workflow_run|contents:\s*write|id-token:|@main|docker\s/);
    assert.match(text, /NODE_OPTIONS: ''/); assert.match(text, /NODE_TLS_REJECT_UNAUTHORIZED: '1'/);
  }
  for (const match of githubText.matchAll(/uses:\s+([\w-]+\/[\w-]+)@([a-f0-9]{40}) # (v\d+)/g)) {
    assert.equal(pins[match[1] + '@' + match[3]], match[2]); assert.notEqual(match[1], 'actions/checkout');
  }
  assert.equal((githubText.match(/uses:/g) ?? []).length, 7);
  assert.equal(githubText.match(/argos\/([a-f0-9]{40})\//)[1], gitlabText.match(/argos\/([a-f0-9]{40})\//)[1]);
});
test('GitLab publisher model isolates environment credentials, transfers ciphertext only and supports read-only resume', () => {
  assert.deepEqual(publication.default.tags, ['argos-ci']); assert.equal(publication.variables.GIT_STRATEGY, 'empty');
  assert.deepEqual(publication.default.cache, []); assert.deepEqual(publication.default.before_script, []); assert.deepEqual(publication.default.after_script, []);
  assert.equal(publication.variables.ARGOS_GITLAB_PUBLISH, 'false');
  const rule = publication.argos_publish.rules[0];
  assert.equal(rule.when, 'always'); assert.match(rule.if, /ARGOS_GITLAB_PUBLISH == "true"/);
  assert.match(rule.if, /CI_COMMIT_REF_PROTECTED == "true"/); assert.match(rule.if, /CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH/);
  assert.doesNotMatch(rule.if, /merge_request/);
  assert.equal(publication['.argos_publication_rules'].rules[0].when, undefined);
  assert.doesNotMatch(publication['.argos_publication_rules'].rules[0].if, /ARGOS_GITLAB_PUBLISH/);
  const control = publication.argos_control, publisher = publication.argos_publish;
  assert.equal(control.environment.name, 'argos-ci'); assert.equal(publisher.environment.name, 'argos-publisher');
  assert.deepEqual(control.dependencies, []); assert.deepEqual(publisher.dependencies, ['argos_control']);
  assert.deepEqual(control.artifacts.paths, ['.argos-ci/evidence.enc.json']); assert.equal(control.artifacts.access, 'maintainer');
  assert.equal(control.artifacts.expire_in, '7 days'); assert.equal(control.artifacts.when, 'always');
  assert.match(control.script.at(-1), /publication-stage/); assert.match(control.script.at(-1), /resume\) export ARGOS_IDEMPOTENCY_KEY=/);
  assert.equal(publisher.script.at(-1), 'env -u ARGOS_API_KEY node argos-ci.mjs publish-gitlab');
  assert.equal(publisher.resource_group, 'argos-gitlab-issues-${CI_PROJECT_ID}');
  assert.doesNotMatch(publicationText, /CI_JOB_TOKEN|glpat-|Bearer |ARGOS_API_KEY:\s*\S/);
});
test('GitHub publisher alone gets issues:write, encrypted artifact by current producer ID, no project code or audit key', () => {
  assert.deepEqual(github.permissions, { contents: 'read' });
  const publisher = github.jobs.argos_publish;
  assert.deepEqual(publisher.permissions, { actions: 'read', issues: 'write' });
  assert.equal(publisher.needs, 'argos_control'); assert.equal(publisher.environment, 'argos-publisher');
  assert.equal(publisher.concurrency.group, 'argos-github-issues-${{ github.repository_id }}');
  assert.equal(publisher.concurrency['cancel-in-progress'], false);
  assert.match(publisher.if, /always\(\)/); assert.match(publisher.if, /SITE_NO_GO/); assert.match(publisher.if, /ARGOS_GITHUB_PUBLISH == 'true'/);
  assert.doesNotMatch(JSON.stringify(publisher), /ARGOS_API_KEY|READ_SAS|checkout|control-result/);
  for (const [name, job] of Object.entries(github.jobs)) if (name !== 'argos_publish') assert.doesNotMatch(JSON.stringify(job.permissions ?? {}), /write/);
  const download = publisher.steps.find(s => s.uses?.startsWith('actions/download-artifact@'));
  assert.equal(download.with['artifact-ids'], '${{ needs.argos_control.outputs.encrypted_artifact_id }}'); assert.equal(download.with['run-id'], undefined);
  const publish = publisher.steps.find(s => s.run === 'node argos-ci.mjs publish-github');
  assert.equal(publish.env.GITHUB_TOKEN, '${{ github.token }}'); assert.equal(publish.env.ARGOS_EVIDENCE_PRODUCER, 'argos_control');
  assert.equal(publish.env.ARGOS_EVIDENCE_SHA256, '${{ needs.argos_control.outputs.evidence_sha256 }}');
  assert.equal(publish.env.ARGOS_CIPHER_SHA256, '${{ needs.argos_control.outputs.cipher_sha256 }}');
  assert.equal(publish.env.ARGOS_EVIDENCE_INVOCATION, '${{ needs.argos_control.outputs.evidence_invocation }}');
  assert.deepEqual(github.on.workflow_dispatch.inputs.operation.options, ['audit', 'resume']);
  const control = github.jobs.argos_control.steps.find(s => s.id === 'control');
  assert.match(control.run, /case "\$ARGOS_CI_OPERATION"/); assert.match(control.run, /resume\) export ARGOS_IDEMPOTENCY_KEY=/);
  const seal = github.jobs.argos_control.steps.find(s => s.id === 'seal');
  assert.doesNotMatch(JSON.stringify(seal), /ARGOS_API_KEY|secrets\.ARGOS_GITHUB_JOURNAL_SAS_URL/);
  const upload = github.jobs.argos_control.steps.find(s => s.id === 'encrypted_upload');
  assert.equal(upload.with.path, '.argos-ci/evidence.enc.json'); assert.equal(upload.with['retention-days'], 7);
});
test('GitHub refuses untrusted events and separates control secrets from artifact/provenance-only preview', () => {
  assert.deepEqual(Object.keys(github.on).sort(), ['push', 'workflow_dispatch']); assert.deepEqual(github.on.push.branches, ['main']);
  assert.match(github.jobs.argos_control.if, /repository\.fork == false/); assert.match(github.jobs.argos_control.if, /default_branch/);
  assert.equal(github.jobs.argos_control.environment, 'argos-ci'); assert.equal(github.concurrency['cancel-in-progress'], false);
  const control = github.jobs.argos_control.steps.find(s => s.id === 'control');
  assert.equal(control.env.ARGOS_API_KEY, '${{ secrets.ARGOS_API_KEY }}'); assert.equal(github.jobs.argos_control['continue-on-error'], undefined);
  assert.match(control.run, /exit "\$status"/); assert.match(control.env.ARGOS_EXPORT_PRIVATE, /ARGOS_PRIVATE_ARTIFACTS/);
  const upload = github.jobs.argos_control.steps.find(s => s.id === 'upload');
  assert.match(upload.if, /destination.outcome == 'success'/); assert.equal(upload.with['retention-days'], 7); assert.equal(upload.with.path, '.argos-ci/evidence.json');
  const destination = github.jobs.argos_control.steps.find(s => s.id === 'destination');
  assert.equal(destination.env.ARGOS_GITHUB_READ_TOKEN, '${{ github.token }}'); assert.match(destination.if, /SITE_NO_GO/);
  const preview = github.jobs.argos_preview; assert.equal(preview.needs, 'argos_control');
  assert.doesNotMatch(JSON.stringify(preview), /ARGOS_API_KEY|secrets\.|CONTROL_FAILED/);
  assert.match(preview.if, /always\(\)/); assert.match(preview.if, /SITE_NO_GO/); assert.match(preview.if, /ARGOS_PUBLICATION_PREVIEW == 'true'/);
  const download = preview.steps.find(s => s.uses?.startsWith('actions/download-artifact@'));
  assert.equal(download.with['artifact-ids'], '${{ needs.argos_control.outputs.artifact_id }}'); assert.equal(download.with['run-id'], undefined);
  const consume = preview.steps.find(s => s.run === 'node argos-ci.mjs publication-preview');
  assert.equal(consume.env.ARGOS_EVIDENCE_SHA256, '${{ needs.argos_control.outputs.evidence_sha256 }}'); assert.equal(consume.env.ARGOS_EVIDENCE_PRODUCER, 'argos_control');
});
test('GitLab requires protected default branch, fresh isolated shell jobs and private opt-in artifacts with limited retention', () => {
  assert.equal(gitlab.variables.GIT_STRATEGY, 'empty'); assert.deepEqual(gitlab.default.cache, []); assert.deepEqual(gitlab.default.tags, ['argos-ci']);
  const rule = gitlab['.argos_rules'].rules[0].if;
  assert.match(rule, /CI_COMMIT_REF_PROTECTED == "true"/); assert.match(rule, /CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH/); assert.doesNotMatch(rule, /merge_request/);
  const control = gitlab.argos_control; assert.equal(control.allow_failure, undefined);
  assert.equal(control.artifacts.access, 'maintainer'); assert.equal(control.artifacts.expire_in, '7 days'); assert.equal(control.artifacts.when, 'always');
  assert.deepEqual(control.artifacts.paths, ['.argos-ci/evidence.json']); assert.match(control.script.at(-1), /unset ARGOS_EXPORT_PRIVATE/);
  assert.match(control.script.at(-1), /ARGOS_PRIVATE_ARTIFACTS/); assert.match(control.script.at(-1), /exit "\$status"/);
  assert.match(control.script.at(-1), /artifact-check/g); assert.match(control.script.at(-1), /unlinkSync/);
  const preview = gitlab.argos_preview; assert.deepEqual(preview.dependencies, ['argos_control']); assert.equal(preview.rules[0].when, 'always');
  assert.match(preview.rules[0].if, /ARGOS_PUBLICATION_PREVIEW == "true"/); assert.match(preview.rules[0].if, /CI_PROJECT_VISIBILITY == "private"/);
  assert.equal(preview.script.at(-1), 'env -u ARGOS_API_KEY node argos-ci.mjs publication-preview');
});
test('all literal shell commands in the two parsed models have valid Bash syntax', () => {
  const commands = Object.values(github.jobs).flatMap(j => j.steps).flatMap(s => s.run ? [s.run] : [])
    .concat([gitlab, publication].flatMap(model => Object.values(model).flatMap(j => Array.isArray(j?.script) ? j.script.filter(s => typeof s === 'string') : [])));
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  for (const command of commands) { const result = spawnSync(bash, ['-n'], { input: command, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); }
});
