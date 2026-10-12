import http from 'node:http';
let hits=0;
http.createServer((req,res)=>{
  if(req.url==='/stats')return res.end(JSON.stringify({hits}));
  if(process.env.PRIVATE_FIXTURE==='true'){hits++;return res.end('private synthetic data');}
  if(req.url==='/redirect')return res.writeHead(302,{location:'http://private.fixture.net/secret'}).end();
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
}).listen(80,'0.0.0.0');
