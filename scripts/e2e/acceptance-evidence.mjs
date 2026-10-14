// Consolidates existing harness outputs; never substitutes fixtures for server evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const suites = {
  shell: 'integrations', analysis: 'partial-report', account: 'profile', usage: 'current',
  domains: 'summary', overview: 'overview', admin: 'detail', evidence: 'available',
};
export function validateSuite(name, data) {
  const rows=Array.isArray(data)?data:data.checks;
  assert.ok(Array.isArray(rows)&&rows.length, `${name}: missing cases`);
  const widths=name==='evidence'?[390,1056]:[320,390,768,1056,1440];
  for(const width of widths) for(const lang of ['fr','en']) for(const theme of ['light','dark']) {
    assert.ok(rows.some(r=>(r.name??r.state)===suites[name]&&r.width===width&&r.lang===lang&&r.theme===theme),
      `${name}: missing ${suites[name]} ${width}/${lang}/${theme}`);
  }
  for(const row of rows) {
    assert.notEqual(row.overflow,true,`${name}: overflow`);
    assert.ok(!row.axeViolations,`${name}: accessibility violation`);
    if(row.screenshot) assert.match(row.screenshot,/^[a-z0-9-]+\.png$/);
  }
  if(['overview','domains','admin'].includes(name))
    for(const width of [320,1056]) for(const lang of ['fr','en']) for(const theme of ['light','dark'])
      assert.ok(rows.some(r=>r.name==='text-200'&&r.width===width&&r.lang===lang&&r.theme===theme),`${name}: missing text resize`);
  if(name==='overview') assert.ok(rows.some(r=>r.name==='polling-terminal'), 'Missing browser terminal polling proof');
  return rows;
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
async function main() {
  const preview=process.argv.includes('--preview');
  assert.ok(preview||process.env.GITHUB_ACTIONS==='true','Use CI for revision-bound evidence, or --preview for unbound local output');
  if(!preview) assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Evidence requires a clean checkout');
  const output='outputs/ui-review/clarte-acceptance';
  await mkdir(output+'/results',{recursive:true});await mkdir(output+'/comparisons',{recursive:true});
  const manifest={version:'clarte-acceptance-v1',provenance:preview?'local-unbound':'clean-ci-checkout',
    testedRevision:preview?null:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    pullRequestHead:preview?null:process.env.PR_HEAD_SHA??null,
    run:preview?null:process.env.GITHUB_RUN_ID, suites:{}, comparisons:[], real:{},
    limits:['Visual responses are synthetic; real lifecycle evidence is separate.',
      'Root font-size 200% is not native browser zoom or a screen-reader test.',
      'No production, real OAuth/SMTP provider, target-host load or deployment approval.']};
  for(const name of Object.keys(suites)) {
    const path=`outputs/ui-review/clarte-${name}/results.json`, bytes=await readFile(path), data=JSON.parse(bytes),rows=validateSuite(name,data);
    const captures=[];
    for(const row of rows) {
      const file=row.screenshot??`${row.state}-${row.lang}-${row.theme}-${row.width}.png`;
      const pixels=await readFile(`outputs/ui-review/clarte-${name}/${file}`);
      captures.push({file,sha256:hash(pixels)});
    }
    await copyFile(path,`${output}/results/${name}.json`);
    manifest.suites[name]={cases:rows.length,browser:data.browser??null,resultsSha256:hash(bytes),captures};
  }
  const lifecycle=await json('outputs/controlled-e2e.json');
  for(const name of ['healthy','errors','redirect','partial','empty','unavailable','antibot','timeout'])
    assert.ok(lifecycle.scenarios.some(s=>s.scenario===name&&s.terminal==='COMPLETED'),`Missing real scenario ${name}`);
  const domain=await json('outputs/ui-review/clarte-domains/real/proof.json');
  for(const key of ['refreshDidNotResubmit','filteredReturnPreserved','domainListUsesSameResource','olderBatchPreserved']) assert.equal(domain[key],true,key);
  const admin=await json('outputs/ui-review/clarte-admin/real/proof.json');
  for(const key of ['regularDenied','sessionsRemainRevoked','usagePreserved','returnPreserved']) assert.equal(admin[key],true,key);
  const restore=await json('outputs/controlled-restore.json');assert.equal(restore.restore,'PASS');assert.equal(restore.reportCountAndHashDigestEqual,true);
  for(const [name,path] of Object.entries({lifecycle:'outputs/controlled-e2e.json',domain:'outputs/ui-review/clarte-domains/real/proof.json',admin:'outputs/ui-review/clarte-admin/real/proof.json',restore:'outputs/controlled-restore.json'})) {
    manifest.real[name]={sha256:hash(await readFile(path))};await copyFile(path,`${output}/results/${name}-real.json`);
  }
  for(const lang of ['fr','en']) {const path=`outputs/ui-review/clarte-evidence/real-${lang}.pdf`;const bytes=await readFile(path);assert.ok(bytes.subarray(0,5).toString()==='%PDF-');manifest.real[`pdf-${lang}`]={sha256:hash(bytes)};}
  const reference=await json('docs/connected-space/reference/manifest.json');
  const comparisons=[['dashboard','overview','overview'],['domain-list','domains','list'],['domain-summary','domains','summary'],['affected-pages','domains','filtered-pages'],['page-report','analysis','partial-report'],['account','account','profile'],['quota','usage','current'],['admin-detail','admin','detail']];
  let html='<!doctype html><html lang="fr"><meta charset="utf-8"><title>Clarté — référence et produit</title><style>body{font:16px system-ui;margin:24px;color:#172239}section{margin:32px 0}.pair{display:flex;gap:20px;align-items:flex-start}figure{margin:0;flex:1;min-width:0}img{width:100%;border:1px solid #ccd}h2{font-size:20px}</style><h1>Référence / produit</h1><p>Données et hauteurs différentes : comparaison de composition, pas égalité pixel. Le prototype possède un cadre de démonstration absent du produit. Les KPI et états suivent les contrats livrés.</p>';
  for(const [ref,suite,state] of comparisons) for(const width of [1056,390]) {
    const refFile=`screenshots/${ref}-${width}.png`,expected=reference.assets.find(a=>a.path===refFile);
    const refPath='docs/connected-space/reference/'+refFile, productPath=`outputs/ui-review/clarte-${suite}/${state}-fr-light-${width}.png`;
    assert.equal(hash(await readFile(refPath)),expected.sha256,'Frozen reference changed');
    const name=`${ref}-${width}`,a=`comparisons/${name}-reference.png`,b=`comparisons/${name}-product.png`;
    await copyFile(refPath,output+'/'+a);await copyFile(productPath,output+'/'+b);
    manifest.comparisons.push({screen:ref,width,reference:a,product:b,referenceSha256:expected.sha256,productSha256:hash(await readFile(productPath))});
    html+=`<section><h2>${name}</h2><div class="pair"><figure><figcaption>Maquette figée</figcaption><img src="${a}" alt="Référence ${name}"></figure><figure><figcaption>Produit / fixture contrôlée</figcaption><img src="${b}" alt="Produit ${name}"></figure></div></section>`;
  }
  await writeFile(output+'/comparisons.html',html+'</html>');
  await writeFile(output+'/manifest.json',JSON.stringify(manifest,null,2));
  console.log(`Acceptance evidence: ${Object.values(manifest.suites).reduce((n,s)=>n+s.cases,0)} visual cases, 16 comparisons, real lifecycle and restore. Human review remains separate.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) await main();
