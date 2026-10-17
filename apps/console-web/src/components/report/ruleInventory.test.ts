import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {expect,it} from 'vitest';
import {findingPlaybook} from './findingPlaybooks';
import {findingContent} from './findingCatalogue';
import type {Issue} from './types';

it('keeps all static producer/policy keys in the inventory and has an honest bilingual disposition',()=>{
  const root=new URL('../../../../../',import.meta.url);
  const result=execFileSync(process.execPath,['scripts/report-rule-inventory.mjs','--check'],{cwd:root,encoding:'utf8'});
  expect(result).toContain('static keys');
  const rows=JSON.parse(readFileSync(new URL('docs/report/rule-inventory.json',root),'utf8')) as {key:string;content:string}[];
  for(const row of rows)for(const lang of ['fr','en'] as const){
    const playbook=findingPlaybook(row.key,lang);
    expect(row.content).toBe(playbook.specific?'specific-fr-en':'explicit-fallback-fr-en');
    expect(playbook.limits).toBeTruthy();
    const content=findingContent({id:row.key,severity:'info',title:row.key,impact:'',recommendation:''} as Issue,lang);
    expect(content.recommendation).toBeTruthy();expect(content.verification).toBeTruthy();
  }
});

it('tracks configured Lighthouse candidates separately from emitted findings and matches their guide coverage',()=>{
  const root=new URL('../../../../../',import.meta.url);
  const inventory=JSON.parse(readFileSync(new URL('docs/report/lighthouse-rule-inventory.json',root),'utf8')) as {
    rows:{key:string;toolVersion:string;content:string;selection:string}[];
  };
  const service=JSON.parse(readFileSync(new URL('apps/lighthouse-service/package.json',root),'utf8'));
  expect(new Set(inventory.rows.map(row=>row.key)).size).toBe(inventory.rows.length);
  for(const row of inventory.rows){
    expect(row.toolVersion).toBe(service.dependencies.lighthouse);
    expect(row.selection).toBe('conditional-at-runtime');
    for(const lang of ['fr','en'] as const)
      expect(row.content).toBe(findingPlaybook(row.key,lang).specific?'specific-fr-en':'explicit-fallback-fr-en');
  }
});
