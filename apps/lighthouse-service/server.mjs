import http from "node:http";
import { parse } from "node:url";
import { once } from "node:events";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

const PORT = 3017;

const server = http.createServer(async (req, res) => {
  const { pathname } = parse(req.url, true);

  if (req.method === "POST" && pathname === "/analyze") {
    try {
      const body = await once(req, "data").then(([chunk]) => JSON.parse(chunk.toString()));
      const { url } = body;

      if (!url || typeof url !== "string") {
        res.writeHead(400).end("Invalid URL");
        return;
      }

      const chrome = await launch({ chromeFlags: ["--headless"] });
      const result = await lighthouse(url, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
      });
      await chrome.kill();

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.lhr)); // Only send the LHR (Lighthouse Result)

    } catch (err) {
      console.error("[lighthouse-service]", err);
      res.writeHead(500).end("Internal Error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

server.listen(PORT, () => {
  console.log(`✅ Lighthouse service listening on :${PORT}`);
});