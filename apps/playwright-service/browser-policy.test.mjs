import test from 'node:test';
import assert from 'node:assert/strict';
import { protectContext, browserFlags, proxyEndpoint } from './browser-policy.mjs';

test('proxy is mandatory and browser flags remove implicit loopback bypass and direct UDP',()=>{
  assert.throws(()=>proxyEndpoint(''));assert.throws(()=>proxyEndpoint('http://u:p@proxy:3128'));
  const flags=browserFlags('http://127.0.0.1:3128');
  assert.ok(flags.includes('--proxy-bypass-list=<-loopback>'));
  assert.ok(flags.includes('--disable-quic'));
  assert.equal(flags.some(flag=>flag.includes('no-sandbox')),false);
});
test('context-wide interceptors refuse secondary requests and unsafe methods before continuing',async()=>{
  let handler,wsHandler,cancelled=0,continued=0,aborted=0;
  await protectContext({ route:async(pattern,fn)=>{assert.equal(pattern,'**/*');handler=fn;},
    routeWebSocket:async(_pattern,fn)=>{wsHandler=fn;},on:()=>{} },()=>cancelled++);
  const attempt=async(url,method='GET')=>handler({request:()=>({url:()=>url,method:()=>method}),
    continue:async()=>continued++,abort:async()=>aborted++});
  for(const url of ['http://127.0.0.1','http://169.254.169.254','http://[::1]','file:///etc/passwd','https://example.com:8080'])await attempt(url);
  await attempt('https://example.com','POST');await attempt('https://example.com','PUT');
  await attempt('https://example.com');assert.equal(continued,1);assert.equal(aborted,7);
  let closed=0;wsHandler({close:()=>closed++});assert.equal(closed,1);
  for(let i=0;i<301;i++)await attempt('https://example.com/asset');
  assert.ok(continued<=300);assert.ok(cancelled>0);
});
