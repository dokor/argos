import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { analysisUrl, publicAddress, resolveTarget } from './policy.mjs';
import { createEgressProxy } from './proxy.mjs';

const denied = ['0.1.2.3','10.1.2.3','127.0.0.2','169.254.169.254','100.64.1.1',
  '172.31.0.1','192.168.0.1','192.0.0.8','192.0.2.1','198.18.0.1','198.51.100.1',
  '203.0.113.1','224.0.0.1','255.255.255.255','::','::1','::ffff:8.8.8.8',
  'fc00::1','fe90::1','ff02::1','2001::1','2001:db8::1','2002:808:808::1','3fff::1'];
test('public-unicast boundaries and all special ranges',()=>{
  for(const ip of denied)assert.equal(publicAddress(ip),false,ip);
  for(const ip of ['8.8.8.8','1.1.1.1','100.63.255.255','100.128.0.1','2606:4700:4700::1111'])assert.equal(publicAddress(ip),true,ip);
});
test('URL ambiguity, credentials, schemes, local names, ports and controls are refused',()=>{
  for(const value of [...denied.map(ip=>`http://${ip.includes(':')?'['+ip+']':ip}/`),
    'http://2130706433','http://0177.0.0.1','http://0x7f000001','http://127.1',
    'https://example.com:8443','http://example.com:443','https://user:secret@example.com',
    'https://%65xample.com','https://example%2ecom','https://%38.8.8.8',
    `https://${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`,
    'https://localhost.','https://local','https://svc.internal','https://foo.test','file:///etc/passwd',
    'https://example.com\\@localhost','https://example.com\n','https://example.com/%00'.repeat(1000)])
    assert.throws(()=>analysisUrl(value),undefined,value);
  for(const value of ['https://example.com','http://example.com:80/path?q=1','https://[2606:4700:4700::1111]',
    'https://xn--caf-dma.fr/caf%C3%A9?q=%26',
    `https://${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`])assert.ok(analysisUrl(value));
});
test('DNS rejects errors, mixed public/private answers and changing resolutions',async()=>{
  const url=analysisUrl('https://example.com');
  await assert.rejects(resolveTarget(url,async()=>[]));
  await assert.rejects(resolveTarget(url,async()=>{throw new Error('DNS down');}));
  await assert.rejects(resolveTarget(url,async()=>[{address:'8.8.8.8'},{address:'127.0.0.1'}]));
  let calls=0;const resolve=async()=>[{address:++calls===1?'8.8.8.8':'127.0.0.1'}];
  assert.equal(await resolveTarget(url,resolve),'8.8.8.8');await assert.rejects(resolveTarget(url,resolve));
});
async function listen(t,server){server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();}));return server.address().port;}
async function fetchProxy(port,url,options={}){return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,path:url,method:options.method??'GET',headers:options.headers},res=>{
    let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body}));});
  req.on('error',reject);req.end();});}
test('HTTP validation precedes the transport, including direct API use and redirects',async t=>{
  let connections=0;const fixture=http.createServer((_req,res)=>res.writeHead(302,{location:'http://127.0.0.1/secret'}).end());
  const fixturePort=await listen(t,fixture);const proxy=await listen(t,createEgressProxy({resolve:async()=>[{address:'8.8.8.8'}],
    request:(options,callback)=>{connections++;assert.equal(options.host,'8.8.8.8');assert.equal(options.headers.host,'example.com');
      assert.equal(options.headers.authorization,undefined);return http.request({...options,host:'127.0.0.1',port:fixturePort},callback);}}));
  const good=await fetchProxy(proxy,'http://example.com/',{headers:{authorization:'Bearer private'}});assert.equal(good.status,302);
  for(const [url,method] of [['http://127.0.0.1/secret','GET'],['http://example.com:8080','GET'],['file:///tmp/test','GET'],['http://example.com/','POST']])
    assert.equal((await fetchProxy(proxy,url,{method})).status,403);
  assert.equal(connections,1);
});
async function tunnel(port,authority){const socket=net.connect(port,'127.0.0.1');await once(socket,'connect');
  socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
  const [data]=await once(socket,'data');return {socket,head:data.toString()};}
test('CONNECT pins the checked IP and refuses the next rebinding answer before connecting',async t=>{
  const fixture=net.createServer(socket=>socket.on('data',data=>socket.write(data)));
  const fixturePort=await listen(t,fixture);let lookups=0,connections=0;
  const proxy=await listen(t,createEgressProxy({resolve:async()=>[{address:++lookups===1?'8.8.8.8':'10.0.0.1'}],
    connect:options=>{connections++;assert.deepEqual(options,{host:'8.8.8.8',port:443});return net.connect(fixturePort,'127.0.0.1');}}));
  const first=await tunnel(proxy,'example.com:443');assert.match(first.head,/200 Connection/);first.socket.destroy();
  const second=await tunnel(proxy,'example.com:443');assert.match(second.head,/403/);second.socket.destroy();
  for(const authority of ['localhost:443','example.com:22','user@example.com:443','[::1]:443']){
    const result=await tunnel(proxy,authority);assert.match(result.head,/403/);result.socket.destroy();}
  assert.equal(connections,1);
});
test('active tunnel limit, deadline and disconnect release capacity',async t=>{
  const fixture=net.createServer(()=>{});const port=await listen(t,fixture);let connections=0;
  const proxy=await listen(t,createEgressProxy({maxConnections:1,timeoutMs:150,resolve:async()=>[{address:'8.8.8.8'}],
    connect:()=>{connections++;return net.connect(port,'127.0.0.1');}}));
  const first=await tunnel(proxy,'example.com:443');
  const busy=await tunnel(proxy,'example.com:443');assert.match(busy.head,/403/);busy.socket.destroy();
  await once(first.socket,'close');
  const next=await tunnel(proxy,'example.com:443');assert.match(next.head,/200/);next.socket.destroy();assert.equal(connections,2);
});
test('policy copies are identical across independently deployed build contexts',async()=>{
  const source=await readFile(new URL('./policy.mjs',import.meta.url),'utf8');
  for(const path of ['../playwright-service/policy.mjs','../lighthouse-service/policy.mjs','../console-web/src/lib/audit-url-policy.mjs'])
    assert.equal(await readFile(new URL(path,import.meta.url),'utf8'),source,path);
});
test('oversized upstream HTTP bodies terminate the socket and release admission',async t=>{
  const fixture=http.createServer((_req,res)=>res.end('x'.repeat(1024)));
  const fixturePort=await listen(t,fixture);
  const proxy=await listen(t,createEgressProxy({maxBytes:16,maxConnections:1,resolve:async()=>[{address:'8.8.8.8'}],
    request:(options,callback)=>http.request({...options,host:'127.0.0.1',port:fixturePort},callback)}));
  await assert.rejects(fetchProxy(proxy,'http://example.com/'));
  assert.equal((await fetchProxy(proxy,'http://10.0.0.1/')).status,403);
});
