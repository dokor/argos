import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
let hits=0, slowHits=0, mutations=0, pageHits=0, outsideHits=0, badCertificateHits=0, stateLeaks=0, credentialHits=0;
const handler=(req,res)=>{
  if(req.url==='/stats')return res.end(JSON.stringify({hits,slowHits,mutations,pageHits,outsideHits,badCertificateHits,stateLeaks,credentialHits}));
  if(process.env.PRIVATE_FIXTURE==='true'){hits++;return res.end('private synthetic data');}
  if(req.headers.host==='outside.fixture.net')outsideHits++;
  if(req.headers.host==='badcert.fixture.net')badCertificateHits++;
  if(Object.values(req.headers).join(' ').includes('synthetic-ci-credential'))credentialHits++;
  if(req.url==='/probe-state' && req.headers.cookie?.includes('fixture-state'))stateLeaks++;
  if(req.url==='/store-state')res.setHeader('Set-Cookie','fixture-state=synthetic; Secure; HttpOnly; SameSite=Lax; Path=/');
  if(req.method!=='GET' && req.method!=='HEAD'){mutations++;return res.writeHead(405).end();}
  if(req.url==='/slow'){
    slowHits++;
    const timer=setTimeout(()=>res.end('<h1>Late fixture</h1>'),60000);
    res.on('close',()=>clearTimeout(timer));
    return;
  }
  if(req.url==='/redirect')return res.writeHead(302,{location:'http://private.fixture.net/secret'}).end();
  if(req.url==='/cross-origin')return res.writeHead(302,{location:'https://outside.fixture.net/forbidden'}).end();
  if(req.url==='/second-origin')return res.writeHead(302,{location:'https://second.fixture.net/'}).end();
  if(req.url==='/chunked' || req.url==='/gzip'){
    const html=Buffer.from('<!doctype html><html lang="en"><head><title>Transfer fixture</title><link rel="icon" href="data:,"></head><body>'
      + 'Synthetic transfer fixture '.repeat(1000) + '</body></html>');
    const compressed=req.url==='/gzip';
    const body=compressed ? gzipSync(html) : html;
    res.writeHead(200,{'Content-Type':'text/html',...(compressed ? {'Content-Encoding':'gzip'} : {})});
    const middle=Math.floor(body.length/2);
    res.write(body.subarray(0,middle));
    const timer=setTimeout(()=>res.end(body.subarray(middle)),25);
    res.on('close',()=>clearTimeout(timer));
    return;
  }
  pageHits++;
  res.setHeader('Content-Type','text/html');
  res.end(`<!doctype html><html lang="en"><head><title>Security fixture</title></head><body><h1>Controlled fixture</h1>
    <iframe src="http://private.fixture.net/frame"></iframe>
    <script>
      console.error('token=synthetic-secret');
      for(const url of ['http://127.0.0.1/secret','http://169.254.169.254/metadata','http://private.fixture.net/fetch'])fetch(url).catch(()=>{});
      fetch('/mutation',{method:'POST',body:'synthetic'}).catch(()=>{});
      try{new WebSocket('ws://private.fixture.net/socket')}catch{}
      const worker=new Worker(URL.createObjectURL(new Blob(["fetch('http://private.fixture.net/worker').catch(()=>{})"],{type:'text/javascript'})));
    </script></body></html>`);
};
http.createServer(handler).listen(80,'0.0.0.0');
if(process.env.CI_TLS_FIXTURE==='true')https.createServer({
  key:readFileSync('/fixture-tls/server.key'),cert:readFileSync('/fixture-tls/server.pem')
},handler).listen(443,'0.0.0.0');
