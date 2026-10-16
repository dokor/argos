import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {explainCoverage} from './explain-coverage.mjs';
const fixture=JSON.parse(readFileSync(new URL('../docs/report/fixtures/coverage-96.json',import.meta.url),'utf8'));
test('frozen catalogue fixture explains rounded 96 and never outputs report identity',()=>{
  const result=explainCoverage({...fixture,url:'https://private.example/report/private?token=secret'});
  assert.equal(result.reconciled,true);assert.equal(result.roundedPercent,96);
  const missing=result.checks.filter(c=>c.missingPercentagePoints>0);
  assert.deepEqual(missing.map(c=>c.key),['observatory.score']);
  assert.ok(Math.abs(missing[0].missingPercentagePoints-8/223*100)<1e-10);
  assert.ok(!JSON.stringify(result).includes('private.example'));
});
test('historical coverage is unavailable and exclusions never contribute missing points',()=>{
  assert.equal(explainCoverage({}).reason,'COVERAGE_NOT_RETAINED');
  const result=explainCoverage({coverage:{version:'historical',global:{expectedWeight:4,measuredWeight:0,ratio:0},checks:[
    {key:'ssl.grade',module:'ssl',domain:'security',state:'BLOCKED_BY_ANTIBOT',reason:'HTTP_CHALLENGE_OBSERVED',weight:4},
    {key:'http.redirect.to_https',module:'http',domain:'security',state:'NOT_APPLICABLE',reason:'INPUT_ALREADY_HTTPS',weight:2},
  ]}});
  assert.equal(result.reconciled,true);assert.equal(result.checks[0].missingPercentagePoints,100);assert.equal(result.checks[1].missingPercentagePoints,0);
});
