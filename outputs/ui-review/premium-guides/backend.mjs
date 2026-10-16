// UI fixture: synthetic address only, no persistence and no outbound request.
import http from "node:http";
http.createServer(async (req, res) => {
  if (req.url !== "/api/premium-waitlist" || req.method !== "POST") { res.writeHead(404); return res.end(); }
  let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 2048) { res.writeHead(400); return res.end(); } }
  let input; try { input = JSON.parse(body); } catch { res.writeHead(400); return res.end(); }
  if (input.email !== "synthetic@example.com" || input.consent !== true) { res.writeHead(400); return res.end(); }
  setTimeout(() => { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end('{"status":"ok"}'); }, 1000);
}).listen(3020, "127.0.0.1", () => console.log("Synthetic Premium UI backend on loopback:3020"));
