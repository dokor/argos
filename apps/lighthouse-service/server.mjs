import { createLighthouseServer } from "./app.mjs";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

const PORT = 3017;
const SERVICE = "lighthouse-service";
const MAX_CONCURRENCY = parsePositiveInteger(process.env.MAX_CONCURRENCY, 1);

// Log structuré (une ligne JSON) horodaté en ISO 8601, exploitable via Docker logs.
function log(event, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event, ...fields }));
}

const CHROME_FLAGS = [
  "--headless",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  // Évite les crashs lorsque /dev/shm est limité par Docker.
  "--disable-dev-shm-usage",
];

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function runLighthouse(url) {
  let chrome;

  try {
    chrome = await launch({
      chromePath: process.env.CHROME_PATH,
      chromeFlags: CHROME_FLAGS,
    });

    return await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      // Titres et descriptions d'audits renvoyés en français (issue #154) : Argos
      // remonte désormais les audits individuels, dont le libellé doit être FR.
      locale: "fr",
    });
  } finally {
    await chrome?.kill();
  }
}

const server = createLighthouseServer({ analyze: runLighthouse, log, maxConcurrency: MAX_CONCURRENCY });

server.listen(PORT, () => {
  log("startup", { port: PORT, maxConcurrency: MAX_CONCURRENCY });
});
