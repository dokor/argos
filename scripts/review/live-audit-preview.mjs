import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
createServer(async (req,res) => {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  try {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    const targeted=path.match(/^\/api\/reports\/review-targeted-([a-z0-9-]+)$/);
    if(targeted) {
      const cases=JSON.parse(await readFile('outputs/targeted-rules/report-cases.json','utf8'));
      const item=cases.find(c=>c.id===targeted[1]);
      if(!item){res.writeHead(404).end('{}');return;}
      res.end(JSON.stringify(item.report));return;
    }
    if (path === '/api/reports/review-real-argos') {
      res.end(await readFile('outputs/live-audit/report.json','utf8')); return;
    }
    for (const demo of ['w3c-bad','js-error','broken-images','mixed-content']) {
      if (path === `/api/reports/review-real-${demo}` || path === `/api/reports/review-before-${demo}`) {
        res.end(await readFile(`outputs/live-audit/${demo}/${path.includes('/review-before-')?'before':'report'}.json`,'utf8')); return;
      }
    }
    const response = await fetch('http://127.0.0.1:3018' + req.url);
    res.statusCode = response.status; res.end(await response.text());
  } catch { res.writeHead(503).end('{}'); }
}).listen(3019,'127.0.0.1');
