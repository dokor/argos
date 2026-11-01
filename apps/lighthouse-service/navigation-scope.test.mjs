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
  const page={on:()=>{}};
  const context={route:async(_,fn)=>{handler=fn;},routeWebSocket:async()=>{},on:()=>{},
    newCDPSession:async()=>({send:async method=>method==='Page.getFrameTree'?{frameTree:{frame:{id:'main'}}}:{},on:()=>{}})};
  await protectContext(context,()=>cancelled++,['https://example.com']);
  const route=(url,main,navigation=true)=>({request:()=>({url:()=>url,method:()=> 'GET',isNavigationRequest:()=>navigation,frame:()=>({parentFrame:()=>main?null:{},page:()=>page})}),continue:async()=>continued++,abort:async()=>aborted++});
  await handler(route('https://example.com/path',true));
  await handler(route('https://cdn.other.com/image.png',false,false));
  await handler(route('https://embed.other.com/frame',false));
  assert.equal(continued,3);
  for(const destination of ['https://www.example.com','https://other.example.com','http://example.com']) await handler(route(destination,true));
  assert.equal(aborted,3);assert.equal(cancelled,3);assert.equal(continued,3);
  await handler(route('http://127.0.0.1/private',false,false));assert.equal(aborted,4);
});

test('redirect responses are stopped before following and initial navigation waits for the guard',async()=>{
  let routeHandler,pageHandler,paused,release,continued=0,cancelled=0;
  const commands=[];
  const ready=new Promise(resolve=>{release=resolve;});
  const page={on:()=>{}};
  const cdp={on:(event,handler)=>{if(event==='Fetch.requestPaused')paused=handler;},send:async(method,args)=>{
    commands.push({method,args});
    if(method==='Page.getFrameTree')return {frameTree:{frame:{id:'main'}}};
    if(method==='Fetch.enable')await ready;
  }};
  await protectContext({route:async(_,handler)=>{routeHandler=handler;},routeWebSocket:async()=>{},
    on:(_,handler)=>{pageHandler=handler;},newCDPSession:async()=>cdp},()=>cancelled++,['https://example.com','https://second.example.com']);
  const event=pageHandler(page);
  const first=routeHandler({request:()=>({url:()=> 'https://example.com',method:()=> 'GET',isNavigationRequest:()=>true,
    frame:()=>({parentFrame:()=>null,page:()=>page})}),continue:async()=>continued++,abort:async()=>assert.fail('Allowed first request aborted')});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(continued,0);
  release();await event;await first;assert.equal(continued,1);
  const response=(location,{frameId='main',status=302}={})=>({requestId:'fixture',frameId,responseStatusCode:status,
    request:{url:'https://example.com/start'},responseHeaders:location?[{name:'Location',value:location}]:[]});
  for(const location of ['/relative','https://second.example.com/page'])await paused(response(location));
  await paused(response('https://embed.example.net',{frameId:'child'}));
  assert.equal(commands.filter(value=>value.method==='Fetch.continueResponse').length,3);
  for(const location of ['https://outside.example.com','http://example.com','https://169.254.169.254','https://user:pass@example.com'])
    await paused(response(location));
  await paused({...response('/relative'),responseHeaders:[{name:'Location',value:'/a'},{name:'location',value:'/b'}]});
  assert.equal(commands.filter(value=>value.method==='Fetch.failRequest').length,5);assert.equal(cancelled,5);
});

test('unavailable redirect instrumentation cannot continue a main navigation',async()=>{
  let handler,aborted=0,continued=0;
  await protectContext({route:async(_,fn)=>{handler=fn;},routeWebSocket:async()=>{},on:()=>{},
    newCDPSession:async()=>{throw new Error('Unavailable');}},()=>{},['https://example.com']);
  await handler({request:()=>({url:()=> 'https://example.com',method:()=> 'GET',isNavigationRequest:()=>true,
    frame:()=>({parentFrame:()=>null,page:()=>({on:()=>{}})})}),continue:async()=>continued++,abort:async()=>aborted++});
  assert.equal(continued,0);assert.equal(aborted,1);
});
