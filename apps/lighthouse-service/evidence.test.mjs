import test from 'node:test';
import assert from 'node:assert/strict';
import {attachLinkNodes,lighthouseEvidence,resourceEvidence,safeResourcePath,safeSelector} from './evidence.mjs';
import {resourceEvidence as runtimeResource} from '../playwright-service/evidence.mjs';

test('SVG structural paths preserve case and remain usable without copying markup',()=>{
 const evidence=lighthouseEvidence({details:{items:[{node:{type:'node',path:'1,HTML,1,BODY,0,svg,0,foreignObject',snippet:'private'}}]}});
 assert.equal(evidence.items[0].nodePath,'1,HTML,1,BODY,0,svg,0,foreignObject');
 assert.doesNotMatch(JSON.stringify(evidence),/private/);
});

test('retains failing ARIA attributes and related nodes without leaking values or explanation text',()=>{
 const evidence=lighthouseEvidence({details:{items:[{node:{type:'node',selector:'main > button',explanation:'aria-expanded="private-value" aria-not-real="secret" aria-token="hidden"',
  },subItems:{items:[{relatedNode:{type:'node',selector:'main > label'}}]}}]}});
 assert.deepEqual(evidence.items[0].attributes,['aria-expanded','aria-not-real']);
 assert.equal(evidence.items[1].selector,'main > label');
 assert.doesNotMatch(JSON.stringify(evidence),/private-value|secret|hidden|aria-token/);
});
test('source-map failures exclude healthy scripts and documentation links',()=>{
 const evidence=lighthouseEvidence({details:{headings:[{key:'scriptUrl',valueType:'url'}],items:[
  {scriptUrl:'https://example.com/bad.js',subItems:{items:[{error:'missing'}]}},
  {scriptUrl:'https://example.com/good.js',subItems:{items:[]}},
  {type:'link',url:'https://docs.example/howto.js'},
 ]}},'https://example.com/','valid-source-maps');
 assert.deepEqual(evidence.items.map(i=>i.resourcePath),['/bad.js']);
});

test('console sourceLocation resolves to the actual audited document, with one-based coordinates',()=>{
 const audit={details:{items:[{sourceLocation:{type:'source-location',url:'https://example.com/javascript_error?token=x',line:7,column:51}}]}};
 const evidence=lighthouseEvidence(audit,'https://example.com/javascript_error?token=x');
 assert.equal(evidence.items[0].locationScope,'ANALYSED_DOCUMENT');
 assert.deepEqual(evidence.items[0].metrics,{sourceLine:8,sourceColumn:52});
 assert.doesNotMatch(JSON.stringify(evidence),/javascript_error|token=x/);
 assert.equal(lighthouseEvidence(audit,'https://example.com/javascript_error?token=other').items[0].locationScope,undefined);
});

test('ambiguous link labels retain distinct nodes from the same Lighthouse gather',()=>{
 const node=i=>({path:`1,HTML,1,BODY,${i},A`,selector:'body > a',snippet:'private'});
 const result={lhr:{audits:{'link-text':{details:{items:[{href:'https://example.com/a',text:'click here'},{href:'https://example.com/a',text:'click here'}]}}}},artifacts:{AnchorElements:[
  {href:'https://example.com/a',text:'different',node:node(0)},
  {href:'https://example.com/a',text:' click here ',node:node(1)},
  {href:'https://example.com/a',text:'click here',node:node(2)},
 ]}};
 attachLinkNodes(result);
 const evidence=lighthouseEvidence(result.lhr.audits['link-text']);
 assert.deepEqual(evidence.items.map(i=>i.nodePath),['1,HTML,1,BODY,1,A','1,HTML,1,BODY,2,A']);
 assert.doesNotMatch(JSON.stringify(evidence),/private|click here/);
});

test('real Lighthouse network-tree and source-location shapes retain usable targets', () => {
 const tree=lighthouseEvidence({details:{type:'list',items:[{type:'list-section',value:{type:'network-tree',chains:{request:{url:'https://site.example/',children:{css:{url:'https://site.example/_next/static/chunks/main.css?token=hidden',navStartToEndTime:324,transferSize:15690,children:{font:{url:'https://site.example/assets/inter.woff2',navStartToEndTime:470}}}}}}}}]}});
 assert.equal(tree.items[1].resourcePath,'/_next/static/chunks/main.css');
 assert.equal(tree.items[1].metrics.navStartToEndTime,324);
 assert.equal(tree.items[2].resourcePath,'/assets/inter.woff2');
 assert.doesNotMatch(JSON.stringify(tree),/hidden|token=/);
 const source=lighthouseEvidence({details:{items:[{url:'https://site.example/app.js',subItems:{items:[{location:{type:'source-location',url:'https://site.example/app.js',line:30,column:11592}}]}}]}});
 assert.deepEqual(source.items[1].metrics,{sourceLine:31,sourceColumn:11593});
});

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
