import http from 'node:http';

export function isValidAnalysisUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2048
      || value !== value.trim() || /[\r\n]/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function createConcurrencyLimiter(limit) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('Invalid concurrency limit');
  let active = 0;
  const waiting = [];
  return async (task) => {
    await new Promise(resolve => {
      if (active < limit) { active++; resolve(); }
      else waiting.push(resolve);
    });
    try { return await task(); }
    finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= 65536) chunks.push(chunk);
  }
  if (bytes > 65536) return { error: 413 };
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
    try {
      const input = await readJson(req);
      if (input.error) { res.writeHead(input.error).end('Invalid request'); return; }
      const url = input.body?.url;
      if (!isValidAnalysisUrl(url)) { res.writeHead(400).end('Invalid URL'); return; }
      safeUrl = url.replace(/[\r\n]+/g, ' ').slice(0, 200);
      log('analyze.start', { url: safeUrl });
      const result = await limited(() => analyze(url));
      // Empty results remain a collector failure, never a fabricated score.
      if (!result?.lhr || typeof result.lhr !== 'object' || Array.isArray(result.lhr)) {
        throw new Error('Missing LHR');
      }
      log('analyze.done', { url: safeUrl, durationMs: Date.now() - startedAt });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.lhr));
    } catch {
      log('analyze.error', { url: safeUrl, durationMs: Date.now() - startedAt, error: 'Collector failure' });
      if (!res.headersSent) res.writeHead(500).end('Internal Error');
    }
  });
}
