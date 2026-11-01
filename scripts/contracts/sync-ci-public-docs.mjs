import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root=new URL('../../',import.meta.url);
const pairs=[
  ['docs/ci/openapi-v1.json','apps/console-web/src/lib/ci-docs-openapi.json'],
  ['docs/ci/openapi-v1.json','apps/console-web/public/docs/openapi-v1.json'],
];
for(const [source,destination] of pairs){
  const expected=readFileSync(new URL(source,root),'utf8').replaceAll('\r\n','\n');
  const target=new URL(destination,root);
  if(process.argv.includes('--check')){
    if(readFileSync(target,'utf8').replaceAll('\r\n','\n')!==expected)throw Error('Public CI docs drift: '+destination);
  }else{mkdirSync(new URL('.',target),{recursive:true});writeFileSync(target,expected);}
}
