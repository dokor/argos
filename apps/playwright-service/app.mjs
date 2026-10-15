import express from 'express';
import { resourceEvidence, evidenceEnvelope, EVIDENCE_LIMIT } from './evidence.mjs';
import { analysisUrl } from './policy.mjs';
import { proxyEndpoint, browserFlags, protectContext, safeOrigin } from './browser-policy.mjs';
import { partitionNetworkErrors, registrableDomainForUrl, isFirstPartyUrl } from './domain.mjs';

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

      const pageDomain = registrableDomainForUrl(url);

      browser = await chromium.launch({ chromiumSandbox: true, args: browserFlags(endpoint), timeout: remaining() });
      if (cancelled) throw new Error('Analysis timeout');
      const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
      await protectContext(context, () => {
        // Pending CDP setup can reject during intentional browser cleanup.
        // Keep cancelling active collection, but preserve an already collected result.
        if (browser) cancel();
      });
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
          const d = loc?.url ? registrableDomainForUrl(loc.url) : pageDomain;
          if (!d || d === pageDomain) consoleErrorsFirstParty++;
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
      page.on('pageerror', (err) => {
        if (jsErrorSamples.length < 10) {
          jsErrorSamples.push({ message: '[site message redacted]' });
        }
      });

      const requests = new Map(); // requestId -> info
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
        incident(request.url(),request.resourceType?.(),undefined,request.failure?.()?.errorText);
        if (failedRequestUrls.length < 300) failedRequestUrls.push(safeOrigin(request.url()));
      });

      page.on('response', async (response) => {
        const url = response.url();
        const status = response.status();
        if (status >= 400 && status < 500) status4xx++;
        if (status >= 500) {
          status5xx++;
          incident(url,response.request?.()?.resourceType?.(),status);
          if (status5xxUrls.length < 300) status5xxUrls.push(safeOrigin(url));
        }

        // bytes estimation (best effort)
        let bytes = 0;
        const cl = response.headers()?.['content-length'];
        if (cl && /^\d+$/.test(cl)) bytes = parseInt(cl, 10);

        totalBytesEstimated += bytes;

        // keep top 10 largest
        if (bytes > 0) {
          const item = { url: safeOrigin(url), bytes, type: (requests.get(url)?.type ?? 'other'), status };
          topLargest.push(item);
          topLargest.sort((a, b) => b.bytes - a.bytes);
          if (topLargest.length > 10) topLargest.length = 10;
        }
      });

      const t0 = Date.now();
      let finalUrl = url;
      let domContentLoadedMs = null;
      let loadMs = null;
      let navigation = { status: 'COMPLETED', reason: null };

      try {
        const response = await page.goto(url, { waitUntil: 'load', timeout: remaining() });
        if (response?.headers()['x-argos-egress-blocked'] === '1') {
          navigation = { status: 'FAILED', reason: 'TARGET_BLOCKED' };
          throw new Error('Target blocked');
        }
        finalUrl = page.url();

        // timings best effort
        // on mesure depuis t0
        // DCL: on peut l'obtenir via waitForLoadState
        await page.waitForLoadState('domcontentloaded', { timeout: remaining() });
        domContentLoadedMs = Date.now() - t0;

        // déjà waitUntil=load, donc loadMs ~ now - t0
        loadMs = Date.now() - t0;

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
        const completedBrowser = browser;
        browser = null;
        await completedBrowser.close();
      }

      if (cancelled) throw new Error('Analysis timeout');

      const networkOwnership = partitionNetworkErrors({ failedRequestUrls, status5xxUrls }, finalUrl);

      log('analyze.done', {
        url: safeUrl,
        durationMs: Date.now() - startedAt,
        consoleErrors,
        jsErrors: jsErrorSamples.length,
        failedRequests,
        status5xx
      });

      res.json({
        url: safeOrigin(url),
        finalUrl: safeOrigin(finalUrl),
        timings: { domContentLoadedMs, loadMs },
        navigation,
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
          failedRequestsFirstParty: networkOwnership.failedRequests.firstParty,
          failedRequestsThirdParty: networkOwnership.failedRequests.thirdParty,
          status4xx,
          status5xx,
          status5xxFirstParty: networkOwnership.status5xx.firstParty,
          status5xxThirdParty: networkOwnership.status5xx.thirdParty,
          totalBytesEstimated,
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
      active--;
      clearTimeout(timer);
      res.removeListener('close', disconnected);
      if (browser) {
        try { await browser.close(); }
        catch { log('analyze.cleanup_error', { error: 'Browser cleanup failed' }); }
      }
    }
  });


  // Body-parser errors must not expose parser stacks or request contents.
  app.use((err, _req, res, _next) => {
    const status = err.status === 413 ? 413 : err.status === 400 ? 400 : 500;
    res.status(status).json({ error: status === 500 ? 'Internal Error' : 'Invalid request' });
  });
  return app;
}
