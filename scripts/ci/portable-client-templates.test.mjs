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
const githubText = read('github-actions.yml'), gitlabText = read('gitlab-ci.yml');
const github = yaml.load(githubText), gitlab = yaml.load(gitlabText, { schema });
const pins = JSON.parse(readFileSync(new URL('../../.github/action-pins.json', import.meta.url), 'utf8'));
const bundle = readFileSync(new URL('../../clients/ci/dist/argos-ci.mjs', import.meta.url));
const checksum = createHash('sha256').update(bundle).digest('hex');

test('both provider templates parse and pin the exact standalone bytes, Node and all actions without running project code', () => {
  for (const text of [githubText, gitlabText]) {
    const urls = [...text.matchAll(/https:\/\/raw\.githubusercontent\.com\/dokor\/argos\/([a-f0-9]{40})\/clients\/ci\/dist\/argos-ci.mjs/g)];
    assert.ok(urls.length); assert.ok(urls.every(u => u[1] === urls[0][1]));
    assert.ok(text.includes(checksum + '  argos-ci.mjs')); assert.match(text, /24\.21\.0/);
    assert.match(text, /--proto '=https' --tlsv1\.2/); assert.match(text, /--max-time 30 --max-redirs 0/);
    const code = text.split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n');
    assert.doesNotMatch(code, /curl[^\n]+\|\s*(?:bash|sh)|npm\s+(?:install|ci)|pull_request_target|workflow_run|issues:\s*write|contents:\s*write|id-token:|@main|docker\s/);
    assert.match(text, /NODE_OPTIONS: ''/); assert.match(text, /NODE_TLS_REJECT_UNAUTHORIZED: '1'/);
  }
  for (const match of githubText.matchAll(/uses:\s+([\w-]+\/[\w-]+)@([a-f0-9]{40}) # (v\d+)/g)) {
    assert.equal(pins[match[1] + '@' + match[3]], match[2]); assert.notEqual(match[1], 'actions/checkout');
  }
  assert.equal((githubText.match(/uses:/g) ?? []).length, 4);
  assert.equal(githubText.match(/argos\/([a-f0-9]{40})\//)[1], gitlabText.match(/argos\/([a-f0-9]{40})\//)[1]);
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
  const commands = github.jobs.argos_control.steps.concat(github.jobs.argos_preview.steps).flatMap(s => s.run ? [s.run] : [])
    .concat(Object.values(gitlab).flatMap(j => Array.isArray(j?.script) ? j.script.filter(s => typeof s === 'string') : []));
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  for (const command of commands) { const result = spawnSync(bash, ['-n'], { input: command, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); }
});
