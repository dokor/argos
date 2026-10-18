import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pipelineResult} from './ci-verdict.mjs';
import {validPolicy,validVerdict} from '../../apps/console-web/src/lib/ci-verdict-contract.mjs';
const resource=name=>JSON.parse(readFileSync(new URL('../../apps/api-backend/src/main/resources/ci/'+name,import.meta.url),'utf8'));
const policy=resource('verdict-policy-v1.json'),catalogue=resource('export-catalog-v1.json'),errors=resource('error-catalog-v1.json').errors;
const base={apiVersion:1,kind:'verdict-v1',admissionId:'a2942a5c-b63a-45cd-a88a-d02b1af5db02',policyId:policy.policyId,policyFingerprint:policy.fingerprint,
  sampleCount:2,outcome:'GO',exitCode:0,error:null,fingerprints:{scoring:'a'.repeat(64),measurement:'b'.repeat(64),scope:'c'.repeat(64)},confirmedFindings:[]};
test('the final process result keeps audit and publication independent',()=>{
  assert.equal(pipelineResult(base).exitCode,0);
  const blocked={...base,outcome:'SITE_NO_GO',exitCode:1,confirmedFindings:[{key:'http.security.csp',category:'security',severity:'critical',ticketEligible:true}]};
  for(const publication of ['DISABLED','PREVIEW','NO_FINDINGS','LIMIT_REACHED','SUCCEEDED'])assert.equal(pipelineResult(blocked,{publication}).exitCode,1);
  for(const publication of ['FAILED','UNKNOWN']) {
    const value=pipelineResult(base,{publication});assert.equal(value.auditOutcome,'GO');assert.equal(value.auditExitCode,0);assert.equal(value.exitCode,3);
    assert.equal(pipelineResult(blocked,{publication}).auditOutcome,'SITE_NO_GO');
  }
});
test('unknown policy, malformed verdicts, inconsistent GO and injected text fail closed',()=>{
  for(const changed of [{...base,policyFingerprint:'d'.repeat(64)},{...base,raw:'synthetic-private-466 ::error::'},
    {...base,sampleCount:1},{...base,exitCode:1},{...base,fingerprints:null},
    {...base,confirmedFindings:[{key:'http.security.csp',category:'security',severity:'critical',ticketEligible:true}]}]) {
    assert.equal(validVerdict(changed,policy,catalogue,errors),false);const result=pipelineResult(changed);assert.equal(result.auditOutcome,'CONTROL_FAILED');assert.equal(result.exitCode,2);assert.equal(result.errorCode,'TRANSPORT_FAILED');
    assert.ok(!JSON.stringify(result).includes('synthetic-private-466'));
  }
  assert.ok(validPolicy(policy,policy));assert.ok(!validPolicy({...policy,exceptions:['runtime-transfer-gap']},policy));
});
test('technical states have explicit controlled diagnostics and never authorize findings',()=>{
  for(const code of ['COLLECTION_TIMEOUT','ANTIBOT_DETECTED','VERDICT_POLICY_UNSUPPORTED','CONFIRMATION_REQUIRED','FINDINGS_UNCONFIRMED','WAIT_TIMEOUT']) {
    const {stage,category,messageKey,actionCode,retryable,recovery}=errors[code];
    const value={...base,outcome:'CONTROL_FAILED',exitCode:2,fingerprints:null,error:{code,stage,category,messageKey,actionCode,retryable,recovery,retryAfterSeconds:null}};
    assert.ok(validVerdict(value,policy,catalogue,errors));assert.equal(pipelineResult(value,{publication:'FAILED'}).exitCode,2);
    assert.ok(!validVerdict({...value,confirmedFindings:[{key:'http.security.csp',category:'security',severity:'critical',ticketEligible:true}]},policy,catalogue,errors));
  }
});
