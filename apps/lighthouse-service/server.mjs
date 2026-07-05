import http from "node:http";
import { parse } from "node:url";
import { once } from "node:events";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

const PORT = 3017;

const CHROME_FLAGS = [
  // Le mode "new" n'est pas disponible sur toutes les versions de Chromium
  // distribuées par Debian. Le flag historique reste compatible et suffit à Lighthouse.
  "--headless",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--remote-debugging-address=127.0.0.1",
];

const server = http.createServer(async (req, res) => {
  const { pathname } = parse(req.url, true);

  // Sonde de disponibilité (healthcheck Docker + vérif amont). Légère : ne
  // lance pas Chrome, répond immédiatement si le process est up.
  if (req.method === "GET" && pathname === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", service: "lighthouse-service" }));
    return;
  }

  if (req.method === "POST" && pathname === "/analyze") {
    let chrome;

    try {
      const body = await once(req, "data").then(([chunk]) => JSON.parse(chunk.toString()));
      const { url } = body;

      if (!url || typeof url !== "string") {
        res.writeHead(400).end("Invalid URL");
        return;
      }

      chrome = await launch({
        chromePath: process.env.CHROME_PATH,
        chromeFlags: CHROME_FLAGS,
        logLevel: "verbose",
      });

      const result = await lighthouse(url, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        // Titres et descriptions d'audits renvoyés en français (issue #154) : Argos
        // remonte désormais les audits individuels, dont le libellé doit être FR.
        locale: "fr",
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.lhr)); // Only send the LHR (Lighthouse Result)
    } catch (err) {
      console.error("[lighthouse-service] Chrome launch or Lighthouse execution failed", err);
      res.writeHead(500).end("Internal Error");
    } finally {
      await chrome?.kill();
    }

    return;
  }

  res.writeHead(404).end("Not Found");
});

server.listen(PORT, () => {
  console.log(`✅ Lighthouse service listening on :${PORT}`);
});