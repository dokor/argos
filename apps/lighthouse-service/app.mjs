import http from 'node:http';
import { lighthouseEvidence } from './evidence.mjs';
import { analysisUrl } from './policy.mjs';
import { safeOrigin, redactDiagnostics, navigationScope } from './browser-policy.mjs';

export function isValidAnalysisUrl(value) {
  try { analysisUrl(value); return true; } catch { return false; }
}

export function createConcurrencyLimiter(limit) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('Invalid concurrency limit');
  let active = 0;
  const waiting = [];
  return async (task, { signal } = {}) => {
    await new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(new Error('Analysis timeout')); return; }
      if (active < limit) { active++; resolve(); }
      else {
        if (waiting.length >= 4) { reject(new Error('Collector busy')); return; }
        const entry = { resolve: () => { signal?.removeEventListener('abort', abort); resolve(); } };
        const abort = () => { const index = waiting.indexOf(entry); if (index >= 0) waiting.splice(index, 1); reject(new Error('Analysis timeout')); };
        waiting.push(entry); signal?.addEventListener('abort', abort, { once: true });
      }
    });
    try { if (signal?.aborted) throw new Error('Analysis timeout'); return await task(); }
    finally {
      const next = waiting.shift();
      if (next) next.resolve();
      else active--;
    }
  };
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 32768) return { error: 413 };
    chunks.push(chunk);
  }
  try { return { body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; }
  catch { return { error: 400 }; }
}

// Inject the collector: contract tests never import Lighthouse or launch Chrome.
export function createLighthouseServer({ analyze, log = () => {}, maxConcurrency = 1 }) {
  const limited = createConcurrencyLimiter(maxConcurrency);
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (req.method === 'GET' && pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'lighthouse-service' }));
      return;
    }
    if (req.method !== 'POST' || pathname !== '/analyze') {
      res.writeHead(404).end('Not Found');
      return;
    }
    let safeUrl = '';
    const startedAt = Date.now();
    const controller = new AbortController();
    let timer;
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnected);
    try {
      const input = await readJson(req);
      if (input.error) { res.writeHead(input.error).end('Invalid request'); return; }
      const url = input.body?.url;
      if (!isValidAnalysisUrl(url)) { res.writeHead(400).end('Invalid URL'); return; }
      let navigationOrigins;
      try { navigationOrigins = navigationScope(input.body?.navigationOrigins,url); }
      catch { res.writeHead(400).end('Invalid navigation scope'); return; }
      safeUrl = safeOrigin(url);
      log('analyze.start', { url: safeUrl });
      const timeoutMs = Number.isFinite(input.body?.timeoutMs) && input.body.timeoutMs > 0 ? Math.min(60000, input.body.timeoutMs) : 60000;
      timer = setTimeout(() => controller.abort(), timeoutMs);
      const result = await limited(() => analyze(url, { signal: controller.signal, timeoutMs,
        ...(navigationOrigins ? { navigationOrigins } : {}) }), { signal: controller.signal });
      if (controller.signal.aborted) throw new Error('Analysis timeout');
      // Empty results remain a collector failure, never a fabricated score.
      if (!result?.lhr || typeof result.lhr !== 'object' || Array.isArray(result.lhr)) {
        throw new Error('Missing LHR');
      }
      log('analyze.done', { url: safeUrl, durationMs: Date.now() - startedAt });
      res.setHeader('Content-Type', 'application/json');
      const safe = redactDiagnostics(result.lhr);
      for (const [id, audit] of Object.entries(result.lhr.audits ?? {})) {
        if (safe.audits?.[id] && typeof audit === 'object' && audit !== null)
          safe.audits[id].observedEvidence = lighthouseEvidence(audit);
      }
      res.end(JSON.stringify(safe));
    } catch (error) {
      log('analyze.error', { url: safeUrl, durationMs: Date.now() - startedAt, error: 'Collector failure' });
      if (!res.headersSent && !res.destroyed) res.writeHead(controller.signal.aborted ? 504 : error.message === 'Collector busy' ? 429 : 500).end(controller.signal.aborted ? 'Analysis timeout' : 'Collector unavailable');
    } finally {
      clearTimeout(timer); res.removeListener('close', disconnected);
    }
  });
}
