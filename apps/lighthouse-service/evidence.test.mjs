import test from 'node:test';
import assert from 'node:assert/strict';
import {lighthouseEvidence,resourceEvidence,safeResourcePath,safeSelector} from './evidence.mjs';
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
 assert.equal(evidence.items[1].resourcePath,'/a.js');
 assert.doesNotMatch(JSON.stringify(evidence),/customer|snippet|abc/);
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

test('keeps actionable font and image locations with the measurements from their own rows',()=>{
 const evidence=lighthouseEvidence({details:{type:'table',items:[
  {url:'https://fonts.example/fonts/inter-latin.woff2?cache=private',wastedMs:180},
  {url:'https://site.example/images/hero.webp',totalBytes:180000,wastedBytes:96000,
   node:{type:'node',path:'1,HTML,1,BODY,2,IMG',selector:'main > img.hero',snippet:'<img alt="Private page text">'}},
  {type:'url',value:'https://cdn.example/assets/app.js',duration:0},
 ]}});
 assert.equal(evidence.items[0].resourcePath,'/fonts/inter-latin.woff2');
 assert.deepEqual(evidence.items[0].metrics,{wastedMs:180});
 assert.equal(evidence.items[1].resourcePath,'/images/hero.webp');
 assert.deepEqual(evidence.items[1].metrics,{totalBytes:180000,wastedBytes:96000});
 assert.equal(evidence.items[2].selector,'main > img.hero');
 assert.deepEqual(evidence.items[3].metrics,{duration:0});
 assert.doesNotMatch(JSON.stringify(evidence),/private|snippet|cache=/i);
});

test('does not turn paths or selectors into a new free-text channel',()=>{
 for(const path of ['/account/profile','/private/person.jpg','/a.js?token=x','/a%3ftoken=x.js',
  '/%2574oken.js','/customer/1.png','//outside.example/a.js','/../a.js','/123456789.png','/image%00.jpg'])
  assert.equal(safeResourcePath(path),null,path);
 for(const selector of ['a[href="private"]','div#customer-email','button:has-text(secret)','div\nsecret','img#123456789'])
  assert.equal(safeSelector(selector),null,selector);
 assert.equal(safeResourcePath('/assets/logo%20small.svg'),'/assets/logo%20small.svg');
 assert.equal(safeSelector('main > section.card:nth-child(2) > img'),'main > section.card:nth-child(2) > img');
 const value=lighthouseEvidence({details:{items:[{url:'https://site.example/a.js',wastedMs:-1,totalBytes:Infinity,width:'12',secret:42}]}});
 assert.equal(value.items[0].metrics,undefined);
});
