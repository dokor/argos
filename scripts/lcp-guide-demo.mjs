// Local teaching fixture only. No third-party site, audit report or user data.
// node scripts/lcp-guide-demo.mjs; compare /before and /after at 390 x 844.
import http from "node:http";
import { readFileSync } from "node:fs";
const image = readFileSync(new URL("../apps/console-web/public/og.png", import.meta.url));
http.createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/hero.png") { res.setHeader("Content-Type", "image/png"); return res.end(image); }
  if (!["/before", "/after"].includes(req.url)) { res.writeHead(404); return res.end(); }
  const img = '<img id="hero" src="/hero.png" width="360" height="189" fetchpriority="high" alt="Argos demonstration">';
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>LCP local demonstration</title>
    <style>body{font:16px system-ui;margin:15px}img{display:block}output{font-size:10px;display:block}</style>
    <h1 style="font-size:20px">LCP local demonstration</h1><div id="target">${req.url === "/after" ? img : ""}</div><output id="sample"></output>
    <script>
    let last;
    new PerformanceObserver(list => { last = list.getEntries().at(-1); }).observe({type:'largest-contentful-paint',buffered:true});
    ${req.url === "/before" ? `setTimeout(()=>document.querySelector('#target').innerHTML=${JSON.stringify(img)},1000);` : ""}
    setTimeout(()=>{
      const resource=performance.getEntriesByType('resource').find(e=>e.name.endsWith('/hero.png'));
      document.querySelector('#sample').textContent=JSON.stringify({lcpMs:last?.startTime,element:last?.element?.id,requestStartMs:resource?.startTime,requestEndMs:resource?.responseEnd});
      document.querySelector('#sample').dataset.testid='finished';
    },1800);
    </script></html>`);
}).listen(3019, "127.0.0.1", () => console.log("Synthetic LCP demonstration: http://127.0.0.1:3019/before and /after"));
