import { readFileSync, writeFileSync } from 'node:fs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8').replaceAll('\r\n','\n');
const clientVersion=/export const VERSION = '([^']+)'/.exec(read('clients/ci/src/resources.mjs'))?.[1];
if(!clientVersion)throw new Error('Missing CI client version');
const content={schemaVersion:1,status:'preview',clientVersion,templates:{github:read('clients/ci/templates/github-actions.yml'),gitlab:read('clients/ci/templates/gitlab-ci.yml'),gitlabPublication:read('clients/ci/templates/gitlab-publication.yml')},
  publication:{github:JSON.parse(read('clients/ci/examples/publication.github.json')),gitlab:JSON.parse(read('clients/ci/examples/publication.gitlab.json'))}};
const expected=JSON.stringify(content,null,2)+'\n',target=new URL('apps/console-web/src/lib/ci-integration-templates.json',root);
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==expected)throw new Error('CI integration templates are stale; run node scripts/contracts/sync-ci-integration-templates.mjs');}
else writeFileSync(target,expected);
