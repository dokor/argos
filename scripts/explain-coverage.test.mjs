import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {explainCoverage,summarizeCoverage} from './explain-coverage.mjs';
import {spawnSync} from 'node:child_process';
const fixture=JSON.parse(readFileSync(new URL('../docs/report/fixtures/coverage-96.json',import.meta.url),'utf8'));
const production=JSON.parse(readFileSync(new URL('../docs/report/fixtures/coverage-production-a.json',import.meta.url),'utf8'));
test('sanitized production evidence explains 77%, all five missing weights and the six excluded units',()=>{
  const result=explainCoverage(production),missing=result.checks.filter(row=>row.missingPercentagePoints>0);
  assert.equal(result.reconciled,true);assert.equal(result.roundedPercent,77);
  assert.equal(result.measuredWeight,167);assert.equal(result.expectedWeight,217);
  assert.equal(missing.length,5);assert.equal(missing.reduce((sum,row)=>sum+row.weight,0),50);
  assert.ok(Math.abs(missing.reduce((sum,row)=>sum+row.missingPercentagePoints,0)-(1-167/217)*100)<1e-10);
  assert.equal(missing.filter(row=>row.reason==='DEADLINE_EXCEEDED').reduce((sum,row)=>sum+row.weight,0),46);
  assert.equal(result.checks.filter(row=>row.state==='NOT_APPLICABLE').reduce((sum,row)=>sum+row.weight,0),6);
  assert.deepEqual(result.domains.map(domain=>Math.round(domain.recordedRatio*100)),[64,93,77,52]);
  assert.ok(result.domains.every(domain=>domain.reconciled));
});
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

const sample=(measured=96,expected=100)=>({scores:{calculation:{scoringVersion:13,
  scoringFingerprint:'fixture-policy',measurementFingerprint:'fixture-profile'}},coverage:{version:'weighted-coverage-v3',global:{
  expectedWeight:expected,measuredWeight:measured,ratio:measured/expected},checks:[
  {key:'http.status_code',module:'http',domain:'security',state:'MEASURED',reason:'CHECK_OBSERVED',
    weight:measured,measurementModule:'http',measurementSources:['http','zap']},
  {key:'observatory.score',module:'observatory',domain:'security',state:'UNAVAILABLE',
    reason:'PROVIDER_RATE_LIMITED',weight:expected-measured},
]}});

test('internal run JSON and public DTO retain exactly the same weights and provenance',()=>{
  const {coverage}=sample();
  assert.deepEqual(explainCoverage({score:{coverage}}),explainCoverage({scores:{coverage}}));
  assert.deepEqual(explainCoverage({score:{coverage}}).checks[0].sources,['http','zap']);
});

test('ratio, domain totals, duplicates and invalid weights cannot be called reconciled',()=>{
  const wrongRatio=sample();wrongRatio.coverage.global.ratio=1;
  assert.equal(explainCoverage(wrongRatio).reconciled,false);
  const wrongDomain=sample();wrongDomain.coverage.domains=[{key:'security',measuredWeight:100,expectedWeight:100,ratio:1}];
  assert.equal(explainCoverage(wrongDomain).reconciled,false);
  const duplicate=sample();duplicate.coverage.checks[1].key=duplicate.coverage.checks[0].key;
  assert.equal(explainCoverage(duplicate).reconciled,false);
  const invalid=sample();invalid.coverage.checks[0].weight='96';
  assert.equal(explainCoverage(invalid).reconciled,false);
  assert.equal(explainCoverage(null).available,false);
});

test('100% fully measured is separate from rounded 100% and partial measurement',()=>{
  assert.equal(explainCoverage(sample(100)).fullyMeasured,true);
  const rounded=explainCoverage(sample(99.6));
  assert.equal(rounded.roundedPercent,100);assert.equal(rounded.fullyMeasured,false);
  const partial=sample(100);partial.coverage.checks[0].confidence='PARTIAL';
  const result=explainCoverage(partial);
  assert.equal(result.partialChecks,1);assert.equal(result.fullyMeasured,false);
});

test('cohort distinguishes rounded 96 from exact 96 and counts missing causes within each method',()=>{
  const result=summarizeCoverage([sample(),sample(95.6),sample(100),sample(99.6),{}]);
  assert.equal(result.unavailable,1);
  const [group]=result.groups;
  assert.equal(group.samples,4);assert.equal(group.rounded96,2);assert.equal(group.exact96,1);
  assert.deepEqual(group.ratioRange96,[0.956,0.96]);
  assert.equal(group.fullyMeasured,1);assert.equal(group.rounded100ButIncomplete,1);
  assert.equal(group.missingChecks96.length,2);
  assert.equal(group.missingChecks96[0].reason,'PROVIDER_RATE_LIMITED');
  assert.equal(group.missingChecks96[0].percentageOf96Samples,50);
});

test('inconsistent reports and different frozen methods never contaminate a recurrence group',()=>{
  const a=sample(),b=sample(),c=sample(),bad=sample();bad.coverage.global.ratio=0.96;bad.coverage.global.measuredWeight=95;
  a.scores.calculation.scoringFingerprint='policy-one';
  b.scores.calculation.scoringFingerprint='policy-two';
  c.scores.calculation.scoringFingerprint='policy-one';c.scores.calculation.measurementFingerprint='changed-profile-private';
  const result=summarizeCoverage([a,b,c,bad]);
  assert.equal(result.groups.length,4);
  assert.equal(result.groups[3].inconsistentSamples,1);
  assert.equal(result.groups[3].rounded96,0);
  assert.ok(!JSON.stringify(result).includes('changed-profile-private'));
});

test('unknown historical profiles are isolated rather than assumed identical',()=>{
  const a=sample(),b=sample();delete a.scores;delete b.scores;
  const result=summarizeCoverage([a,b]);
  assert.equal(result.groups.length,2);
  assert.ok(result.groups.every(group=>!group.methodologyRetained));
});

test('CLI errors omit private input paths and JSON payloads',()=>{
  const result=spawnSync(process.execPath,['scripts/explain-coverage.mjs','private-target-secret.json'],
    {cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/INPUT_UNREADABLE/);
  assert.ok(!result.stderr.includes('private-target-secret'));
  assert.equal(result.stdout,'');
});
