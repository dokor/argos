import express from 'express';
import { resourceEvidence, scriptEvidence, exceptionEvidence, evidenceEnvelope, EVIDENCE_LIMIT } from './evidence.mjs';
import { analysisUrl } from './policy.mjs';
import { proxyEndpoint, browserFlags, protectContext, safeOrigin } from './browser-policy.mjs';
import { partitionNetworkErrors, isFirstPartyUrl } from './domain.mjs';

export function isValidAnalysisUrl(value) {
  try { analysisUrl(value); return true; } catch { return false; }
}

// Sanitise une URL avant journalisation : supprime les CR/LF (anti log-forging)
// et borne la longueur pour éviter des lignes de log démesurées.
function sanitizeUrlForLog(url) {
  if (typeof url !== 'string') return '';
  return safeOrigin(url);
}

export function createRuntimeApp({ chromium, log = () => {}, proxy = process.env.AUDIT_EGRESS_PROXY, maxConcurrency = 2 }) {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 4) throw new Error('Invalid concurrency');
  let active = 0;
  const app = express();
  app.use(express.json({ limit: '8kb' }));

  // Sonde de disponibilité (healthcheck Docker + vérif amont). Volontairement
  // légère : ne lance pas de navigateur, répond immédiatement si le process est up.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'playwright-service' });
  });

  app.post('/analyze/runtime', async (req, res) => {
    const { url } = req.body ?? {};
    if (!isValidAnalysisUrl(url)) return res.status(400).json({ error: 'Invalid URL' });
    let endpoint;
    try { endpoint = proxyEndpoint(proxy); } catch { return res.status(503).json({ error: 'Collector unavailable' }); }
    if (active >= maxConcurrency) return res.status(429).json({ error: 'Collector busy' });
    active++;
    let browser;
    const timeoutMs = Number.isFinite(req.body?.timeoutMs) && req.body.timeoutMs > 0 ? Math.min(45000, req.body.timeoutMs) : 45000;
    const deadline = performance.now() + timeoutMs;
    let cancelled = false;
    const cancel = () => { cancelled = true; void browser?.close().catch(() => {}); };
    const timer = setTimeout(cancel, timeoutMs);
    const disconnected = () => { if (!res.writableEnded) cancel(); };
    res.once('close', disconnected);
    const remaining = () => Math.max(1, Math.ceil(deadline - performance.now()));
    try {

      const safeUrl = sanitizeUrlForLog(url);
      const startedAt = Date.now();
      log('analyze.start', { url: safeUrl });

      browser = await chromium.launch({ chromiumSandbox: true, args: browserFlags(endpoint), timeout: remaining() });
      if (cancelled) throw new Error('Analysis timeout');
      const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
      await protectContext(context, () => {
        // Pending CDP setup can reject during intentional browser cleanup.
        // Keep cancelling active collection, but preserve an already collected result.
        if (browser) cancel();
      });
      const page = await context.newPage();
      let collecting = true;

      const consoleSamples = [];
      const consoleLocations = [], exceptionLocations = [];
      let consoleErrors = 0;
      const consoleErrorOrigins = new Map();
      let consoleOriginsComplete = true;
      let consoleWarnings = 0;

      page.on('console', (msg) => {
        if (!collecting) return;
        const type = msg.type(); // log, error, warning, ...
        const loc = msg.location?.();
        if (type === 'error') {
          consoleErrors++;
          if (consoleLocations.length < EVIDENCE_LIMIT) {
            const item = scriptEvidence(loc?.url, loc?.lineNumber, loc?.columnNumber, page.url());
            if (item) consoleLocations.push(item);
          }
          // Sans URL de localisation (script inline / eval) : attribué au site.
          const origin = loc?.url ? safeOrigin(loc.url) : '';
          if (consoleErrorOrigins.has(origin) || consoleErrorOrigins.size < 300)
            consoleErrorOrigins.set(origin, (consoleErrorOrigins.get(origin) ?? 0) + 1);
          else consoleOriginsComplete = false;
        }
        if (type === 'warning') consoleWarnings++;

        if ((type === 'error' || type === 'warning') && consoleSamples.length < 10) {
          consoleSamples.push({
            type,
            text: '[site message redacted]',
            location: loc?.url ? safeOrigin(loc.url) : undefined
          });
        }
      });

      const jsErrorSamples = [];
      let jsErrorCount = 0;
      page.on('pageerror', (err) => {
        if (!collecting) return;
        jsErrorCount++;
        if (exceptionLocations.length < EVIDENCE_LIMIT) {
          const item = exceptionEvidence(err, page.url());
          if (item) exceptionLocations.push(item);
        }
        if (jsErrorSamples.length < 10) {
          jsErrorSamples.push({ message: '[site message redacted]' });
        }
      });

      const transfers = new Map(); // Request identity keeps repeated URLs independent.
      const byteMeasurements = [];
      let failedRequests = 0;
      let status4xx = 0;
      let status5xx = 0;
      const failedRequestUrls = [];
      const status5xxUrls = [];
      const incidents=[];
      let incidentCount=0;
      function incident(rawUrl, type, status, failure) {
        incidentCount++;
        if(incidents.length>=EVIDENCE_LIMIT) return;
        const resource=resourceEvidence(rawUrl); if(!resource) return;
        // Chromium reason code only, never a site-controlled error message or stack.
        const reason=typeof failure==='string' && /^net::ERR_[A-Z_]{1,60}$/.test(failure) ? failure : undefined;
        const resourceType=['document','stylesheet','image','media','font','script','xhr','fetch','other'].includes(type)?type:undefined;
        incidents.push({...resource, status, reason, resourceType});
      }
      const byType = {};

      page.on('request', (request) => {
        if (!collecting) return;
        const type = request.resourceType(); // document, script, image, xhr, fetch...
        byType[type] = (byType[type] ?? 0) + 1;
      });

      page.on('requestfailed', (request) => {
        if (!collecting) return;
        failedRequests++;
        incident(request.url(),request.resourceType?.(),undefined,request.failure?.()?.errorText);
        if (failedRequestUrls.length < 300) failedRequestUrls.push(safeOrigin(request.url()));
      });

      page.on('response', (response) => {
        if (!collecting) return;
        const url = response.url();
        const status = response.status();
        if (status >= 400 && status < 500) status4xx++;
        if (status >= 500) {
          status5xx++;
          incident(url,response.request?.()?.resourceType?.(),status);
          if (status5xxUrls.length < 300) status5xxUrls.push(safeOrigin(url));
        }

        const request = response.request();
        transfers.set(request, { url: safeOrigin(url), bytes: null, type: request.resourceType(), status });
      });
      page.on('requestfinished', request => {
        if (!collecting) return;
        const transfer = transfers.get(request);
        if (!transfer) return;
        // Chromium measures encoded bytes for chunked/compressed responses too.
        // Headers alone cannot prove the body was transferred completely.
        byteMeasurements.push(Promise.resolve().then(() => request.sizes()).then(sizes => {
          if (Number.isSafeInteger(sizes?.responseBodySize) && sizes.responseBodySize >= 0)
            transfer.bytes = sizes.responseBodySize;
        }).catch(() => { /* Failed size collection remains unknown, never zero. */ }));
      });

      const t0 = performance.now();
      let finalUrl = url;
      let domContentLoadedMs = null;
      let loadMs = null;
      let navigation = { status: 'COMPLETED', reason: null };
      page.on('domcontentloaded', () => { domContentLoadedMs = Math.round(performance.now() - t0); });
      page.on('load', () => { loadMs = Math.round(performance.now() - t0); });

      try {
        const response = await page.goto(url, { waitUntil: 'load', timeout: remaining() });
        if (response?.headers()['x-argos-egress-blocked'] === '1') {
          navigation = { status: 'FAILED', reason: 'TARGET_BLOCKED' };
          throw new Error('Target blocked');
        }
        finalUrl = page.url();

        // petit idle pour capturer XHR tardifs (MVP)
        await page.waitForTimeout(Math.min(1500, remaining()));
      } catch (e) {
        // si le site bloque, on renvoie ce qu’on a
        if (navigation.reason !== 'TARGET_BLOCKED') navigation = { status: 'FAILED', reason: 'NAVIGATION_ERROR' };
        log('analyze.navigation_error', { url: safeUrl, error: 'Navigation failed' });
      } finally {
        // page.url() reflète aussi la dernière URL atteinte si la navigation échoue
        // après une redirection. La classification doit utiliser cette URL finale,
        // et non l'URL initialement saisie par l'utilisateur.
        finalUrl = page.url() || finalUrl;
        // Freeze the observation window, then settle size reads before closing CDP.
        // The existing request deadline still cancels a stalled browser call.
        collecting = false;
        await Promise.all(byteMeasurements);
        const completedBrowser = browser;
        browser = null;
        await completedBrowser.close();
      }

      if (cancelled) throw new Error('Analysis timeout');

      const observedTransfers = [...transfers.values()];
      const totalBytesEstimated = observedTransfers.reduce((total, item) => total + (item.bytes ?? 0), 0);
      const bytesComplete = observedTransfers.length > 0 && observedTransfers.every(item => item.bytes !== null)
        && Number.isSafeInteger(totalBytesEstimated);
      const topLargest = observedTransfers.filter(item => item.bytes > 0)
        .sort((a, b) => b.bytes - a.bytes).slice(0, 10);
      const networkOwnership = partitionNetworkErrors({ failedRequestUrls, status5xxUrls }, finalUrl);
      const consoleErrorsFirstParty = consoleOriginsComplete
        ? [...consoleErrorOrigins].reduce((count, [origin, occurrences]) =>
            count + (!origin || isFirstPartyUrl(origin, finalUrl) ? occurrences : 0), 0) : null;

      log('analyze.done', {
        url: safeUrl,
        durationMs: Date.now() - startedAt,
        consoleErrors,
        jsErrors: jsErrorCount,
        failedRequests,
        status5xx
      });

      res.json({
        url: safeOrigin(url),
        finalUrl: safeOrigin(finalUrl),
        timings: { domContentLoadedMs, loadMs },
        navigation,
        console: {
          errors: consoleOriginsComplete ? consoleErrors : null,
          errorsFirstParty: consoleErrorsFirstParty,
          warnings: consoleWarnings,
          samples: consoleSamples,
          observedEvidence: evidenceEnvelope('runtime', consoleLocations.map(item=>({...item,
            ownership:isFirstPartyUrl(item.origin,finalUrl)?'FIRST_PARTY':'THIRD_PARTY'})), consoleErrors, consoleErrors>consoleLocations.length)
        },
        jsErrors: { count: jsErrorCount, samples: jsErrorSamples,
          observedEvidence: evidenceEnvelope('runtime', exceptionLocations, jsErrorCount, jsErrorCount>exceptionLocations.length) },
        network: {
          requests: Object.values(byType).length
            ? Object.values(byType).reduce((a, b) => a + b, 0)
            : 0,
          failedRequests: failedRequests <= failedRequestUrls.length ? failedRequests : null,
          failedRequestsFirstParty: failedRequests <= failedRequestUrls.length ? networkOwnership.failedRequests.firstParty : null,
          failedRequestsThirdParty: failedRequests <= failedRequestUrls.length ? networkOwnership.failedRequests.thirdParty : null,
          status4xx,
          status5xx: status5xx <= status5xxUrls.length ? status5xx : null,
          status5xxFirstParty: status5xx <= status5xxUrls.length ? networkOwnership.status5xx.firstParty : null,
          status5xxThirdParty: status5xx <= status5xxUrls.length ? networkOwnership.status5xx.thirdParty : null,
          totalBytesEstimated: bytesComplete ? totalBytesEstimated : null,
          observedEvidence: evidenceEnvelope('runtime', incidents.map(item=>({...item,
            ownership:isFirstPartyUrl(item.origin,finalUrl)?'FIRST_PARTY':'THIRD_PARTY'})), incidentCount,
            incidentCount>incidents.length),
          byType,
          topLargest
        }
      });
    } catch {
      log('analyze.error', { error: 'Collector failure' });
      if (!res.destroyed) res.status(cancelled ? 504 : 500).json({ error: cancelled ? 'Analysis timeout' : 'Internal Error' });
    } finally {
      clearTimeout(timer);
      res.removeListener('close', disconnected);
      if (browser) {
        try { await browser.close(); }
        catch { log('analyze.cleanup_error', { error: 'Browser cleanup failed' }); }
      }
      active--;
    }
  });


  // Body-parser errors must not expose parser stacks or request contents.
  app.use((err, _req, res, _next) => {
    const status = err.status === 413 ? 413 : err.status === 400 ? 400 : 500;
    res.status(status).json({ error: status === 500 ? 'Internal Error' : 'Invalid request' });
  });
  return app;
}
