import { chromium } from 'playwright';
import { createRuntimeApp } from './app.mjs';

const PORT = process.env.PORT || 3016;
const SERVICE = 'playwright-service';
function log(event, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event, ...fields }));
}
const app = createRuntimeApp({ chromium, log });
const server = app.listen(PORT, '0.0.0.0', () => {
  log('startup', { port: Number(PORT) });
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.maxConnections = 32;
