import http from 'node:http';
import net from 'node:net';
import { Transform } from 'node:stream';
import { analysisUrl, resolveTarget } from './policy.mjs';

// No upstream/body/URL logging. No fallback, pooling, or second DNS lookup.
export function createEgressProxy({ resolve, connect = net.connect, request = http.request, maxConnections = 32,
  maxBytes = 20 * 1024 * 1024, timeoutMs = 45000 } = {}) {
  let active = 0, count = 0, window = Date.now();
  const sockets = new Set();
  const server = http.createServer({maxHeaderSize:16384,requestTimeout:10000,headersTimeout:10000});
  server.maxConnections = 64;
  server.on('connection', socket => { sockets.add(socket); socket.on('close',()=>sockets.delete(socket)); socket.setTimeout(timeoutMs,()=>socket.destroy()); });
  const acquire = () => {
    if (Date.now()-window >= 60000) {count=0;window=Date.now();}
    if (active >= maxConnections || count >= 1000) throw new Error('Busy');
    active++;count++; let released=false;
    return () => {if(!released){released=true;active--;}};
  };
  const meter = (stop, initialBytes=0) => {
    let bytes=initialBytes;
    return new Transform({transform(chunk,_encoding,callback){
      bytes+=chunk.length;
      if(bytes>maxBytes){stop();callback(new Error('Volume limit'));}else callback(null,chunk);
    }});
  };
  server.on('request',async(req,res)=>{
    let release, upstream, timer;
    const stop=()=>{upstream?.destroy();res.destroy();};
    const cleanup=()=>{clearTimeout(timer);upstream?.destroy();release?.();};
    res.once('close',cleanup);
    try {
      if(!['GET','HEAD'].includes(req.method) || req.headers.upgrade || req.headers['transfer-encoding']
        || Number(req.headers['content-length']??0)!==0) throw new Error('Forbidden');
      const url=analysisUrl(req.url);
      if(url.protocol!=='http:') throw new Error('Forbidden');
      release=acquire(); timer=setTimeout(stop,timeoutMs);
      const ip=await resolveTarget(url,resolve);
      if(res.destroyed) return;
      // Header allowlist prevents proxy credentials, hop-by-hop headers and forged Host.
      const headers={host:url.host,'user-agent':'argos-auditor/1.0',connection:'close'};
      for(const name of ['accept','accept-language','accept-encoding','range','if-none-match','if-modified-since'])
        if(req.headers[name])headers[name]=req.headers[name];
      upstream=request({host:ip,port:80,path:url.pathname+url.search,method:req.method,headers,agent:false},response=>{
        res.writeHead(response.statusCode,response.headers);
        const measured=meter(stop); measured.on('error',stop);
        response.on('error',stop);response.pipe(measured).pipe(res);
      });
      upstream.on('error',stop);upstream.end();
    }catch{if(!res.headersSent&&!res.destroyed)res.writeHead(403,{'X-Argos-Egress-Blocked':'1'}).end('Target unavailable');}
  });
  server.on('connect',async(req,client,head)=>{
    let release, upstream, timer;
    const stop=()=>{client.destroy();upstream?.destroy();};
    client.once('close',()=>{clearTimeout(timer);upstream?.destroy();release?.();});
    client.on('error',stop);
    try {
      // CONNECT is HTTPS only; authority parser cannot accept paths/credentials.
      if(!/^(?:[a-z0-9.-]+|\[[0-9a-f:]+\]):443$/i.test(req.url))throw new Error('Forbidden');
      if(head.length > maxBytes)throw new Error('Volume limit');
      const url=analysisUrl('https://'+req.url);
      release=acquire();timer=setTimeout(stop,timeoutMs);
      const ip=await resolveTarget(url,resolve);
      if(client.destroyed)return;
      upstream=connect({host:ip,port:443});
      upstream.on('error',stop);
      upstream.once('connect',()=>{
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if(head.length)upstream.write(head);
        for(const [from,to] of [[client,upstream],[upstream,client]]){
          const measured=meter(stop,from===client?head.length:0);measured.on('error',stop);from.pipe(measured).pipe(to);
        }
      });
    }catch{client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');}
  });
  server.on('upgrade',(_req,socket)=>socket.destroy());
  server.on('clientError',(_error,socket)=>socket.destroy());
  server.closeAllConnections=()=>{for(const socket of sockets)socket.destroy();};
  return server;
}
