import test from 'node:test';
import assert from 'node:assert/strict';
import { protectContext, browserFlags, proxyEndpoint, auditLogContext } from './browser-policy.mjs';
import { protectContext as protectLighthouseContext } from '../lighthouse-service/browser-policy.mjs';

test('log context excludes URL secrets and accepts only bounded numeric run IDs', () => {
  const url = 'https://user:private@example.com/reset/private?token=private#private';
  assert.deepEqual(auditLogContext(url, '42'), { origin: 'https://example.com', runId: '42' });
  for (const invalid of [undefined, null, [], 'private', '42\n', '42\r', '0', '-1', '1'.repeat(20)])
    assert.deepEqual(auditLogContext(url, invalid), { origin: 'https://example.com' });
});

test('proxy is mandatory and browser flags remove implicit loopback bypass and direct UDP',()=>{
  assert.throws(()=>proxyEndpoint(''));assert.throws(()=>proxyEndpoint('http://u:p@proxy:3128'));
  const flags=browserFlags('http://127.0.0.1:3128');
  assert.ok(flags.includes('--proxy-bypass-list=<-loopback>'));
  assert.ok(flags.includes('--disable-quic'));
  assert.equal(flags.some(flag=>flag.includes('no-sandbox')),false);
});
for (const [collector, protect] of [['Playwright', protectContext], ['Lighthouse', protectLighthouseContext]]) {
test(`${collector} context-wide interceptors refuse secondary requests and unsafe methods before continuing`,async()=>{
  let handler,wsHandler,cancelled=0,continued=0,aborted=0;
  await protect({ route:async(pattern,fn)=>{assert.equal(pattern,'**/*');handler=fn;},
    routeWebSocket:async(_pattern,fn)=>{wsHandler=fn;},on:()=>{} },()=>cancelled++);
  const attempt=async(url,method='GET')=>handler({request:()=>({url:()=>url,method:()=>method}),
    continue:async()=>continued++,abort:async()=>aborted++});
  for(const url of ['http://127.0.0.1','http://169.254.169.254','http://[::1]',
    'http://[fc00::1]', 'http://[fd00::1234]', 'http://[::ffff:127.0.0.1]',
    'file:///etc/passwd','https://example.com:8080'])await attempt(url);
  await attempt('https://example.com','POST');await attempt('https://example.com','PUT');
  await attempt('https://example.com');assert.equal(continued,1);assert.equal(aborted,10);
  let closed=0;wsHandler({close:()=>closed++});assert.equal(closed,1);
  for(let i=0;i<301;i++)await attempt('https://example.com/asset');
  assert.ok(continued<=300);assert.ok(cancelled>0);
});
}
