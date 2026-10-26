import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
createServer(async (req,res) => {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  try {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (path === '/api/reports/review-real-argos') {
      res.end(await readFile('outputs/live-audit/report.json','utf8')); return;
    }
    const response = await fetch('http://127.0.0.1:3018' + req.url);
    res.statusCode = response.status; res.end(await response.text());
  } catch { res.writeHead(503).end('{}'); }
}).listen(3019,'127.0.0.1');
