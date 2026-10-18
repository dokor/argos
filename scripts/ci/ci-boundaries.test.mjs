import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { trustedEndpoint,boundedJson } from './trusted-http.mjs';
import { readTrustedEvidence,MAX_EVIDENCE_BYTES } from './trusted-artifact.mjs';
import { githubApi } from './self-audit-tickets.mjs';

test('credentials cannot follow a report-selected origin, path or redirect',async()=>{
  for(const path of ['@attacker.example/x','//attacker.example/x','https://attacker.example','/../outside','/%2e%2e/outside','/a\\b','/x\r\n::error::']) {
    assert.throws(()=>trustedEndpoint('https://argos.lelouet.fr',path));
    let calls=0;
    const api=githubApi('synthetic-private-value',{fetcher:async()=>{calls++;assert.fail('invalid endpoint contacted');}});
    await assert.rejects(api('POST',path));assert.equal(calls,0);
  }
  for(const origin of ['http://argos.lelouet.fr','https://user:pass@argos.lelouet.fr','https://argos.lelouet.fr/path','https://argos.lelouet.fr?secret=value'])
    assert.throws(()=>trustedEndpoint(origin,'/api/ci/v1/preflight'));
  assert.equal(trustedEndpoint('https://argos.lelouet.fr','/api/ci/v1/preflight'),'https://argos.lelouet.fr/api/ci/v1/preflight');
  let followed=false;
  const api=githubApi('synthetic-private-value',{fetcher:async(_url,options)=>{
    assert.equal(options.redirect,'error');followed=true;
    return new Response('synthetic-private-value ::error::',{status:302,headers:{location:'https://attacker.example'}});
  }});
  await assert.rejects(api('POST','/issues'),e=>!e.message.includes('synthetic-private-value'));assert.equal(followed,true);
});

test('malformed, oversized, non-UTF8 and stalled upstream bodies stay behind a controlled error',async()=>{
  for(const response of [Response.json({value:'x'.repeat(100)}),new Response('<html>synthetic-private-value</html>'),
    new Response(Uint8Array.from([0xc3,0x28]),{headers:{'Content-Type':'application/json'}})])
    await assert.rejects(boundedJson(response,32),e=>!e.message.includes('synthetic-private-value'));
  let canceled=false;
  const abort=new AbortController();
  const response=new Response(new ReadableStream({pull(){},cancel(){canceled=true;}}),{headers:{'Content-Type':'application/json'}});
  const reading=boundedJson(response,1024,abort.signal);abort.abort();
  await assert.rejects(reading);assert.equal(canceled,true);
});

test('only the bounded regular artifact with the producer hash and exact run provenance is consumed',t=>{
  const root=mkdtempSync(join(tmpdir(),'argos-ci-evidence-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,'evidence.json');
  const data={repository:'dokor/argos',invocation:'123:1',expectedSha:'a'.repeat(40)};
  const bytes=JSON.stringify(data);
  const expected={repository:'dokor/argos',invocation:'123:1',sha:'a'.repeat(40),digest:createHash('sha256').update(bytes).digest('hex')};
  writeFileSync(path,bytes);assert.deepEqual(readTrustedEvidence(path,expected),data);
  for(const changed of [{digest:'0'.repeat(64)},{sha:'b'.repeat(40)},{invocation:'124:1'},{repository:'attacker/repository'},{digest:undefined}])
    assert.throws(()=>readTrustedEvidence(path,{...expected,...changed}));
  writeFileSync(path,bytes+' ');assert.throws(()=>readTrustedEvidence(path,expected));
  writeFileSync(path,'x'.repeat(MAX_EVIDENCE_BYTES+1));assert.throws(()=>readTrustedEvidence(path,expected));
  writeFileSync(path,bytes);
  const link=join(root,'link.json');
  if(process.platform!=='win32'){symlinkSync(path,link);assert.throws(()=>readTrustedEvidence(link,expected));}
  assert.throws(()=>readTrustedEvidence(root,expected));
});

test('workflow actions are pinned to reviewed full commits and privileged publishing stays on trusted main',()=>{
  const root=new URL('../../.github/',import.meta.url);
  const pins=JSON.parse(readFileSync(new URL('action-pins.json',root),'utf8'));
  for(const file of readdirSync(new URL('workflows/',root)).filter(name=>/\.ya?ml$/.test(name))) {
    const workflow=readFileSync(new URL('workflows/'+file,root),'utf8');
    assert.doesNotMatch(workflow,/^\s+(?:pull_request_target|workflow_run):/m,file);
    for(const match of workflow.matchAll(/uses:\s+([^\s#]+)(?:[^\S\r\n]+# ([^\s]+))?/g)) {
      if(match[1].startsWith('./'))continue;
      const action=/^([\w-]+\/[\w-]+)@([a-f0-9]{40})$/.exec(match[1]);
      assert.ok(action,'Mutable action in '+file);assert.equal(pins[action[1]+'@'+match[2]],action[2],file);
    }
  }
  const workflow=readFileSync(new URL('workflows/post-deploy-audit.yml',root),'utf8');
  const publisher=workflow.split('\n  tickets:')[1];
  assert.match(publisher,/github.repository == 'dokor\/argos' && github.ref == 'refs\/heads\/main'/);
  assert.match(publisher,/needs.control.outputs.artifact_id != '' && needs.control.outputs.evidence_sha256 != ''/);
  assert.match(publisher,/artifact-ids: \$\{\{ needs.control.outputs.artifact_id \}\}/);
  assert.match(publisher,/EXPECTED_EVIDENCE_SHA256: \$\{\{ needs.control.outputs.evidence_sha256 \}\}/);
  assert.doesNotMatch(publisher,/ARGOS_CI_(?:EMAIL|PASSWORD)|id-token:|contents: write/);
  assert.doesNotMatch(publisher,/run:\s+.*\$\{\{/);
});
