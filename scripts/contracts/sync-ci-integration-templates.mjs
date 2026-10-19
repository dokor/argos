import { readFileSync, writeFileSync } from 'node:fs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8').replaceAll('\r\n','\n');
const clientVersion=/export const VERSION = '([^']+)'/.exec(read('clients/ci/src/resources.mjs'))?.[1];
if(!clientVersion)throw new Error('Missing CI client version');
const replaceOnce=(text,before,after)=>{if(text.split(before).length!==2)throw new Error('CI preview transform no longer matches the reviewed source');return text.replace(before,after);};
const github=read('clients/ci/templates/github-actions.yml'),gitlabPublication=read('clients/ci/templates/gitlab-publication.yml');
const githubPreview=replaceOnce(replaceOnce(github,'      issues: write\n','      issues: read\n'),
  '          ARGOS_GITHUB_JOURNAL_SAS_URL: ${{ secrets.ARGOS_GITHUB_JOURNAL_SAS_URL }}\n',
  '          ARGOS_GITHUB_JOURNAL_READ_SAS_URL: ${{ secrets.ARGOS_GITHUB_JOURNAL_READ_SAS_URL }}\n');
const gitlabPreview=replaceOnce(replaceOnce(gitlabPublication,'    name: argos-publisher\n','    name: argos-publisher-preview\n'),
  '    - env -u ARGOS_API_KEY node argos-ci.mjs publish-gitlab\n',
  '    - env -u ARGOS_API_KEY -u ARGOS_GITLAB_PUBLISH_TOKEN -u ARGOS_GITLAB_JOURNAL_SAS_URL node argos-ci.mjs publish-gitlab\n');
const content={schemaVersion:1,status:'preview',clientVersion,templates:{github,gitlab:read('clients/ci/templates/gitlab-ci.yml'),gitlabPublication,githubPreview,gitlabPreview},
  publication:{github:JSON.parse(read('clients/ci/examples/publication.github.json')),gitlab:JSON.parse(read('clients/ci/examples/publication.gitlab.json'))}};
const expected=JSON.stringify(content,null,2)+'\n',target=new URL('apps/console-web/src/lib/ci-integration-templates.json',root);
if(process.argv.includes('--check')){if(readFileSync(target,'utf8').replaceAll('\r\n','\n')!==expected)throw new Error('CI integration templates are stale; run node scripts/contracts/sync-ci-integration-templates.mjs');}
else writeFileSync(target,expected);
