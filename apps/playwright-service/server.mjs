import { chromium } from 'playwright';
import { createRuntimeApp } from './app.mjs';

const PORT = process.env.PORT || 3016;
const SERVICE = 'playwright-service';
function log(event, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event, ...fields }));
}
const app = createRuntimeApp({ chromium, log });
app.listen(PORT, '0.0.0.0', () => {
  log('startup', { port: Number(PORT) });
});
