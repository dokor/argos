import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSuite, suites} from './acceptance-evidence.mjs';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const rows=()=>[390,1056].flatMap(width=>['fr','en'].flatMap(lang=>['light','dark'].map(theme=>({state:'available',width,lang,theme,overflow:false,axeViolations:0}))));
test('accepts complete recorded matrix',()=>assert.equal(validateSuite('evidence',rows()).length,8));
test('rejects absent, smoke-only and failing evidence',()=>{
 assert.throws(()=>validateSuite('evidence',{}));
 assert.throws(()=>validateSuite('evidence',rows().filter(r=>r.width===1056)));
 assert.throws(()=>validateSuite('evidence',rows().map(r=>({...r,overflow:true}))));
 assert.throws(()=>validateSuite('evidence',rows().map(r=>({...r,axeViolations:1}))));
});
test('rejects paths outside the capture directory',()=>assert.throws(()=>validateSuite('evidence',rows().map(r=>({...r,screenshot:'../private.png'})))));

test('visual-only CLI requires complete visual evidence without claiming a server lifecycle', () => {
 const root=mkdtempSync(join(tmpdir(),'argos-visual-evidence-'));
 const save=(path,content)=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,content);};
 const capture=Buffer.from('synthetic image bytes for manifest hashing');
 const output='outputs/ui-review/clarte-acceptance';
 const run=(...args)=>spawnSync(process.execPath,[fileURLToPath(new URL('./acceptance-evidence.mjs',import.meta.url)),'--preview',...args],{cwd:root,encoding:'utf8',timeout:10000});
 try {
  for(const [suite,state] of Object.entries(suites)) {
   const cases=(suite==='evidence'?[390,1056]:[320,390,768,1056,1440]).flatMap(width=>
    ['fr','en'].flatMap(lang=>['light','dark'].map(theme=>({name:state,state,width,lang,theme}))));
   if(['overview','domains','admin'].includes(suite)) cases.push(...cases.filter(r=>[320,1056].includes(r.width)).map(r=>({...r,name:'text-200',state:'text-200'})));
   if(suite==='overview') cases.push({name:'polling-terminal',state:'polling-terminal',width:1056,lang:'fr',theme:'light'});
   save(`outputs/ui-review/clarte-${suite}/results.json`,JSON.stringify(cases));
   for(const row of cases) save(`outputs/ui-review/clarte-${suite}/${row.state}-${row.lang}-${row.theme}-${row.width}.png`,capture);
  }
  const comparisons=[['dashboard','overview','overview'],['domain-list','domains','list'],['domain-summary','domains','summary'],['affected-pages','domains','filtered-pages'],['page-report','analysis','partial-report'],['account','account','profile'],['quota','usage','current'],['admin-detail','admin','detail']];
  const assets=[];
  for(const [ref,suite,state] of comparisons) for(const width of [1056,390]) {
   const path=`screenshots/${ref}-${width}.png`;
   save('docs/connected-space/reference/'+path,capture);
   assets.push({path,sha256:createHash('sha256').update(capture).digest('hex')});
   save(`outputs/ui-review/clarte-${suite}/${state}-fr-light-${width}.png`,capture);
  }
  save('docs/connected-space/reference/manifest.json',JSON.stringify({assets}));
  const visual=run('--visual-only');
  assert.equal(visual.status,0,visual.stderr);
  const manifest=JSON.parse(readFileSync(join(root,output,'manifest.json'),'utf8'));
  assert.equal(manifest.version,'clarte-visual-v1');
  assert.equal(manifest.scope,'visual-only');
  assert.equal(manifest.testedRevision,null);
  assert.deepEqual(manifest.real,{});
  assert.equal(manifest.comparisons.length,16);
  const combined=run();
  assert.notEqual(combined.status,0,'Combined mode must still require real lifecycle evidence');
  assert.match(combined.stderr,/controlled-e2e.json/);
  save('outputs/ui-review/clarte-evidence/results.json',JSON.stringify(rows().filter(r=>r.width===1056)));
  const incomplete=run('--visual-only');
  assert.notEqual(incomplete.status,0,'Visual-only mode must not accept a reduced matrix');
  assert.match(incomplete.stderr,/evidence: missing available 390/);
 } finally { rmSync(root,{recursive:true,force:true}); }
});
