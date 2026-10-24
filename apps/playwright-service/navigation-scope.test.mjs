import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationScope, protectContext } from './browser-policy.mjs';

test('scope rejects empty, ambiguous, foreign and non-HTTPS initial origins',()=>{
  assert.equal(navigationScope(undefined,'http://example.com'),undefined);
  assert.deepEqual(navigationScope(['https://example.com'],'https://example.com/page'),['https://example.com']);
  for(const value of [null,[],['https://example.com/'],['https://example.com','https://example.com'],['http://example.com'],['https://example.com/path'],['https://other.example.com']])
    assert.throws(()=>navigationScope(value,'https://example.com'));
});
test('main redirects and popups outside the exact scope abort before contact while public subresources and child frames remain allowed',async()=>{
  let handler,cancelled=0,continued=0,aborted=0;
  const context={route:async(_,fn)=>{handler=fn;},routeWebSocket:async()=>{},on:()=>{}};
  await protectContext(context,()=>cancelled++,['https://example.com']);
  const route=(url,main,navigation=true)=>({request:()=>({url:()=>url,method:()=> 'GET',isNavigationRequest:()=>navigation,frame:()=>({parentFrame:()=>main?null:{}})}),continue:async()=>continued++,abort:async()=>aborted++});
  await handler(route('https://example.com/path',true));
  await handler(route('https://cdn.other.com/image.png',false,false));
  await handler(route('https://embed.other.com/frame',false));
  assert.equal(continued,3);
  for(const destination of ['https://www.example.com','https://other.example.com','http://example.com']) await handler(route(destination,true));
  assert.equal(aborted,3);assert.equal(cancelled,3);assert.equal(continued,3);
  await handler(route('http://127.0.0.1/private',false,false));assert.equal(aborted,4);
});
