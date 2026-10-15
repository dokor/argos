import test from 'node:test';
import assert from 'node:assert/strict';
import {lighthouseEvidence,resourceEvidence} from './evidence.mjs';
import {resourceEvidence as runtimeResource} from '../playwright-service/evidence.mjs';

test('resource identities exclude credentials, query, fragment and raw path in both collectors',()=>{
 const input='https://user:password@site.example/private-person/secret-token.js?token=credential#fragment';
 const expected=resourceEvidence(input);
 assert.deepEqual(expected,runtimeResource(input));
 assert.equal(expected.origin,'https://site.example');
 assert.match(expected.resourceRef,/^[a-f0-9]{16}$/);
 assert.equal(resourceEvidence('https://site.example/private-person/secret-token.js').resourceRef,expected.resourceRef);
 assert.doesNotMatch(JSON.stringify(expected),/password|credential|fragment|private-person|secret-token/);
 for(const url of ['javascript:alert(1)','data:secret','not an url','https://example.com/'+ 'a'.repeat(2048)]) assert.equal(resourceEvidence(url),null);
});
test('preserves only observed structural locations and explicit absence',()=>{
 const evidence=lighthouseEvidence({details:{items:[{node:{type:'node',path:'1,HTML,1,BODY,2,IMG',selector:'#customer-email',snippet:'<img alt="secret">'}}, {url:'https://cdn.example/a.js?secret=abc'}]}});
 assert.equal(evidence.state,'AVAILABLE');assert.equal(evidence.items.length,2);
 assert.equal(evidence.items[0].nodePath,'1,HTML,1,BODY,2,IMG');
 assert.doesNotMatch(JSON.stringify(evidence),/customer|snippet|abc|a.js/);
 assert.equal(lighthouseEvidence({numericValue:12}).state,'UNAVAILABLE');
 assert.equal(lighthouseEvidence({details:{items:[{node:{type:'node',path:'1,HTML,SECRET=email@example.com',selector:'#secret'}}]}}).state,'UNAVAILABLE');
});
test('samples and traversal are bounded without claiming an exhaustive inventory',()=>{
 const evidence=lighthouseEvidence({details:{items:Array.from({length:1000},(_,i)=>({url:`https://site.example/${i}`}))}});
 assert.equal(evidence.items.length,10);assert.ok(evidence.truncated);assert.ok(evidence.inspected<=400);
 const duplicated=lighthouseEvidence({details:{items:[{url:'https://site.example/a?one'},{url:'https://site.example/a?two'}]}});
 assert.equal(duplicated.items.length,1);
 const unusable=lighthouseEvidence({details:{items:Array(10000).fill('ignored')}});
 assert.ok(unusable.inspected<=400);assert.ok(unusable.truncated);assert.equal(unusable.state,'UNAVAILABLE');
});
