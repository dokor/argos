import { createLighthouseServer } from "./app.mjs";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { chromium } from "playwright";
import puppeteer from "puppeteer-core";
import { createLighthouseCollector } from "./collector.mjs";

const PORT = 3017;
const SERVICE = "lighthouse-service";
const MAX_CONCURRENCY = 1; // One isolated Chrome/DevTools port per namespace.

// Log structuré (une ligne JSON) horodaté en ISO 8601, exploitable via Docker logs.
function log(event, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event, ...fields }));
}

const CHROME_FLAGS = [
  "--headless",
  "--disable-gpu",
  // Évite les crashs lorsque /dev/shm est limité par Docker.
  "--disable-dev-shm-usage",
];

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const runLighthouse = createLighthouseCollector({ launch, lighthouse, log,
  chromium,
  connectPuppeteer: options => puppeteer.connect(options),
  chromeFlags: CHROME_FLAGS, chromePath: process.env.CHROME_PATH });

const server = createLighthouseServer({ analyze: runLighthouse, log, maxConcurrency: MAX_CONCURRENCY });

server.listen(PORT, () => {
  log("startup", { port: PORT, maxConcurrency: MAX_CONCURRENCY });
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.maxConnections = 32;
