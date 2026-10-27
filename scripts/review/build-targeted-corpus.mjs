// Regenerate after both verify-targeted scripts. Only synthetic, allowlisted data.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const inputs=await Promise.all(['a11y','lighthouse'].map(async kind=>JSON.parse(await readFile(`outputs/targeted-rules/${kind}-results.json`,'utf8')).map(c=>({...c,method:c.method??'browser-axe-before-after',category:kind==='a11y'?'accessibility':'performance'}))));
const cases=inputs.flat();
const inventory=JSON.parse(await readFile('docs/report/lighthouse-rule-inventory.json','utf8'));
assert.equal(cases.length,93);assert.ok(cases.every(c=>c.verified));
const corpus=cases.map(c=>{
 const phase=which=>{
  const p=c[which].product;
  return {score:p.score,scoreDisplayMode:p.notApplicable?'notApplicable':p.scoreDisplayMode??'binary',title:c.id,
   ...(typeof p.displayValue==='string'?{displayValue:p.displayValue}:{}),
   ...(p.explanation?{explanation:typeof p.explanation==='string'?p.explanation:p.explanation.formattedDefault}:{}),
   ...(p.numericValue!==undefined?{numericValue:p.numericValue,numericUnit:p.numericUnit}:{}),
   ...(['bf-cache','document-latency-insight','lcp-breakdown-insight'].includes(c.id)?{details:p.details}:{}),
   observedEvidence:c[which].observed};
 };
 return {id:c.id,method:c.method,category:inventory.rows.find(r=>r.key==='lighthouse.audit.'+c.id)?.categories[0]?.key??c.category,change:c.change,expectedTargets:c.expectedTargets??c.before.expectedTargets,
  semanticTarget:c.semanticTarget,related:c.related,before:phase('before'),after:phase('after')};
});
const path='apps/api-backend/src/test/resources/targeted-rules';
await mkdir(path,{recursive:true});
await writeFile(`${path}/lighthouse-cases.json`,'[\n'+corpus.map(c=>'  '+JSON.stringify(c)).join(',\n')+'\n]\n');
console.log(`${corpus.length} controlled before/after cases exported`);
