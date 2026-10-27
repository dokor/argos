// Explicit repository test against synthetic documents only; no production URLs.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {a11yCases,documentFor} from './targeted-a11y-cases.mjs';
import {lighthouseEvidence} from '../../apps/lighthouse-service/evidence.mjs';
const require=createRequire(new URL('../../apps/lighthouse-service/package.json',import.meta.url));
const {chromium}=require('playwright');
const axePath=require.resolve('axe-core/axe.min.js');
const browser=await chromium.launch({headless:true});
const results=[];
try {
 for(const test of a11yCases) {
  const observations=[];
  for(const fixed of [false,true]) {
   const page=await browser.newPage({viewport:{width:1024,height:768}});
   await page.route('**/*',route=>route.abort());
   await page.setContent(documentFor(test,fixed));
   await page.addScriptTag({path:axePath});
   const result=await page.evaluate(async id=>{
    const result=await window.axe.run(document,{runOnly:{type:'rule',values:[id]},elementRef:true});
    function nodeDetails(element) {
     const parts=[],path=[];
     for(let n=element;n?.nodeType===1;n=n.parentElement) {
      parts.unshift(n.localName+':nth-child('+(Array.from(n.parentNode.children).indexOf(n)+1)+')');
      const siblings=Array.from(n.parentNode.childNodes).filter(c=>c.nodeType!==3||c.textContent.trim());
      path.unshift(siblings.indexOf(n),n.tagName);
     }
     return {selector:parts.join(' > '),devtoolsNodePath:path.join(','),nodeLabel:element.tagName,snippet:element.outerHTML.slice(0,300)};
    }
    const convert=r=>({id:r.id,impact:r.impact,tags:r.tags,nodes:r.nodes.map(n=>({
     node:nodeDetails(n.element),failureSummary:n.failureSummary,
     relatedNodes:[...new Set([...n.any,...n.all,...n.none].flatMap(c=>c.relatedNodes??[]).map(x=>x.element).filter(e=>e&&e!==n.element))].slice(0,3).map(nodeDetails),
    }))});
    return {violations:result.violations.map(convert),notApplicable:result.inapplicable.map(convert),incomplete:result.incomplete.map(convert),passes:result.passes.map(r=>r.id)};
   },test.id);
   const Audit=(await import(`../../apps/lighthouse-service/node_modules/lighthouse/core/audits/accessibility/${test.id}.js`)).default;
   const product=await Audit.audit({Accessibility:result});
   const observed=lighthouseEvidence(product,'https://targeted.example/case',test.id);
   const targets=observed.items.filter(i=>i.kind==='element');
   for(const target of targets) {
    assert.equal(await page.locator(target.selector).count(),1,`${test.id}: target must be unique`);
    assert.ok(target.nodePath,`${test.id}: structural path must survive Lighthouse's node adapter`);
    assert.ok(await page.evaluate(({selector,nodePath})=>nodePath.split(',').filter((_,i)=>i%2===0).map(Number)
      .reduce((n,i)=>[...n.childNodes].filter(c=>c.nodeType!==3||c.textContent.trim())[i],document)===document.querySelector(selector),target),`${test.id}: path and selector must identify the same element`);
   }
   observations.push({score:product.score,notApplicable:product.notApplicable??false,passes:result.passes.includes(test.id),
    expectedTargets:result.violations.find(r=>r.id===test.id)?.nodes.flatMap(n=>[n.node,...n.relatedNodes]).map(n=>n.selector)??[],
    product,observed});
   await page.close();
  }
  const [before,after]=observations;
  const verified=before.score===0&&(after.score===1||after.notApplicable)&&before.expectedTargets.every(s=>before.observed.items.some(i=>i.selector===s));
  results.push({id:test.id,change:test.change,verified,before,after});
  console.log(`${verified?'PASS':'CHECK'} ${test.id}: ${before.score} -> ${after.score}${after.notApplicable?' (not applicable)':''}; targets=${before.observed.items.length}`);
 }
} finally {await browser.close();}
await mkdir('outputs/targeted-rules',{recursive:true});
await writeFile('outputs/targeted-rules/a11y-results.json',JSON.stringify(results,null,2));
const failed=results.filter(r=>!r.verified);
console.log(JSON.stringify({total:results.length,verified:results.length-failed.length,failed:failed.map(r=>r.id)}));
if(failed.length) process.exitCode=1;
