import { createLighthouseServer } from "./app.mjs";
import { createSupervisedCollector } from "./supervisor.mjs";

const PORT = 3017;
const SERVICE = "lighthouse-service";
const MAX_CONCURRENCY = 1; // One isolated Chrome/DevTools port per namespace.

// Log structuré (une ligne JSON) horodaté en ISO 8601, exploitable via Docker logs.
function log(event, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event, ...fields }));
}

const runLighthouse = createSupervisedCollector({ log });

const server = createLighthouseServer({ analyze: runLighthouse, log, maxConcurrency: MAX_CONCURRENCY });

server.listen(PORT, () => {
  log("startup", { port: PORT, maxConcurrency: MAX_CONCURRENCY });
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.maxConnections = 32;
