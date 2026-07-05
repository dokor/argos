import express from 'express';
import { chromium } from 'playwright';

const PORT = process.env.PORT || 3016;
const SERVICE = 'playwright-service';

// Sanitise une URL avant journalisation : supprime les CR/LF (anti log-forging)
// et borne la longueur pour éviter des lignes de log démesurées.
function sanitizeUrlForLog(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/[\r\n]+/g, ' ').slice(0, 200);
}

// Log structuré (une ligne JSON) horodaté en ISO 8601, exploitable via Docker logs.
function log(event, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event, ...fields }));
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// Sonde de disponibilité (healthcheck Docker + vérif amont). Volontairement
// légère : ne lance pas de navigateur, répond immédiatement si le process est up.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'playwright-service' });
});

// Domaine enregistrable (approx eTLD+1 : deux derniers labels) pour distinguer
// les erreurs du site des erreurs de scripts tiers (issue #153).
function registrableDomain(host) {
  if (!host) return '';
  const parts = host.split('.');
  return parts.length <= 2 ? host : parts.slice(-2).join('.');
}
function hostOf(u) {
  try { return registrableDomain(new URL(u).hostname); } catch { return ''; }
}

app.post('/analyze/runtime', async (req, res) => {
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const safeUrl = sanitizeUrlForLog(url);
  const startedAt = Date.now();
  log('analyze.start', { url: safeUrl });

  const pageDomain = hostOf(url);

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleSamples = [];
  let consoleErrors = 0;
  let consoleErrorsFirstParty = 0;
  let consoleWarnings = 0;

  page.on('console', (msg) => {
    const type = msg.type(); // log, error, warning, ...
    const text = msg.text();
    const loc = msg.location?.();
    if (type === 'error') {
      consoleErrors++;
      // Sans URL de localisation (script inline / eval) : attribué au site.
      const d = loc?.url ? hostOf(loc.url) : pageDomain;
      if (!d || d === pageDomain) consoleErrorsFirstParty++;
    }
    if (type === 'warning') consoleWarnings++;

    if ((type === 'error' || type === 'warning') && consoleSamples.length < 10) {
      consoleSamples.push({
        type,
        text: text.slice(0, 500),
        location: loc?.url ? `${loc.url}:${loc.lineNumber ?? ''}:${loc.columnNumber ?? ''}` : undefined
      });
    }
  });

  const jsErrorSamples = [];
  page.on('pageerror', (err) => {
    if (jsErrorSamples.length < 10) {
      jsErrorSamples.push({ message: String(err?.message ?? err).slice(0, 500) });
    }
  });

  const requests = new Map(); // requestId -> info
  let failedRequests = 0;
  let status4xx = 0;
  let status5xx = 0;
  let totalBytesEstimated = 0;

  const byType = {};
  const topLargest = [];

  page.on('request', (request) => {
    const type = request.resourceType(); // document, script, image, xhr, fetch...
    byType[type] = (byType[type] ?? 0) + 1;

    requests.set(request.url(), {
      url: request.url(),
      type,
      method: request.method()
    });
  });

  page.on('requestfailed', (request) => {
    failedRequests++;
  });

  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    if (status >= 400 && status < 500) status4xx++;
    if (status >= 500) status5xx++;

    // bytes estimation (best effort)
    let bytes = 0;
    const cl = response.headers()?.['content-length'];
    if (cl && /^\d+$/.test(cl)) bytes = parseInt(cl, 10);

    totalBytesEstimated += bytes;

    // keep top 10 largest
    if (bytes > 0) {
      const item = { url, bytes, type: (requests.get(url)?.type ?? 'other'), status };
      topLargest.push(item);
      topLargest.sort((a, b) => b.bytes - a.bytes);
      if (topLargest.length > 10) topLargest.length = 10;
    }
  });

  const t0 = Date.now();
  let finalUrl = url;
  let domContentLoadedMs = null;
  let loadMs = null;

  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    finalUrl = page.url();

    // timings best effort
    // on mesure depuis t0
    // DCL: on peut l'obtenir via waitForLoadState
    await page.waitForLoadState('domcontentloaded', { timeout: 45000 });
    domContentLoadedMs = Date.now() - t0;

    // déjà waitUntil=load, donc loadMs ~ now - t0
    loadMs = Date.now() - t0;

    // petit idle pour capturer XHR tardifs (MVP)
    await page.waitForTimeout(1500);
  } catch (e) {
    // si le site bloque, on renvoie ce qu’on a
    log('analyze.navigation_error', { url: safeUrl, error: String(e?.message ?? e).slice(0, 300) });
  } finally {
    await browser.close();
  }

  log('analyze.done', {
    url: safeUrl,
    durationMs: Date.now() - startedAt,
    consoleErrors,
    jsErrors: jsErrorSamples.length,
    failedRequests,
    status5xx
  });

  res.json({
    url,
    finalUrl,
    timings: { domContentLoadedMs, loadMs },
    console: {
      errors: consoleErrors,
      errorsFirstParty: consoleErrorsFirstParty,
      warnings: consoleWarnings,
      samples: consoleSamples
    },
    jsErrors: { count: jsErrorSamples.length, samples: jsErrorSamples },
    network: {
      requests: Object.values(byType).length
        ? Object.values(byType).reduce((a, b) => a + b, 0)
        : 0,
      failedRequests,
      status4xx,
      status5xx,
      totalBytesEstimated,
      byType,
      topLargest
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  log('startup', { port: Number(PORT) });
});
