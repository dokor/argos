import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { groups, runGroup } from './visual-suites.mjs';

test('parallel groups have existing, disjoint suite scripts', () => {
  const scripts=Object.values(groups).flat();
  assert.equal(new Set(scripts).size,scripts.length);
  for(const script of scripts) assert.ok(existsSync(new URL('./'+script+'.mjs',import.meta.url)),script);
});
test('successful group executes each suite once', () => {
  const calls=[];
  assert.equal(runGroup('analysis',(_command,args)=>{calls.push(args[0]);return {status:0};}),0);
  assert.equal(calls.length,groups.analysis.length);
});
test('a failing or interrupted suite cannot produce a successful group', () => {
  let calls=0;
  assert.equal(runGroup('analysis',()=>{calls++;return {status:37};}),37);
  assert.equal(calls,1);
  assert.throws(()=>runGroup('domains',()=>({status:null,signal:'SIGTERM'})),/without a result/);
  assert.throws(()=>runGroup('domains',()=>({error:new Error('spawn failed')})),/spawn failed/);
  assert.throws(()=>runGroup('unknown',()=>({status:0})),/Unknown visual group/);
});
