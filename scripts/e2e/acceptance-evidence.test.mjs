import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSuite} from './acceptance-evidence.mjs';
const rows=()=>[390,1056].flatMap(width=>['fr','en'].flatMap(lang=>['light','dark'].map(theme=>({state:'available',width,lang,theme,overflow:false,axeViolations:0}))));
test('accepts complete recorded matrix',()=>assert.equal(validateSuite('evidence',rows()).length,8));
test('rejects absent, smoke-only and failing evidence',()=>{
 assert.throws(()=>validateSuite('evidence',{}));
 assert.throws(()=>validateSuite('evidence',rows().filter(r=>r.width===1056)));
 assert.throws(()=>validateSuite('evidence',rows().map(r=>({...r,overflow:true}))));
 assert.throws(()=>validateSuite('evidence',rows().map(r=>({...r,axeViolations:1}))));
});
test('rejects paths outside the capture directory',()=>assert.throws(()=>validateSuite('evidence',rows().map(r=>({...r,screenshot:'../private.png'})))));
