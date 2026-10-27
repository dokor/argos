// Local experiment only. This is not the application's production server.
// Serves byte-identical precompressed JS/CSS from a loopback Next fixture.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { brotliCompress, brotliDecompressSync, constants } from 'node:zlib';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const [app, variant] = process.argv.slice(2);
if (!app || !['before', 'after'].includes(variant)) throw new Error('Provide app and before/after.');
const root = resolve(app, '.next/static');
const compressed = new Map();
const compress = promisify(brotliCompress);
let html;
for (let attempt = 0; attempt < 120; attempt++) {
  try { const r = await fetch('http://127.0.0.1:3021/'); if (r.ok) { html = await r.text(); break; } } catch {}
  await delay(250);
}
if (!html) throw new Error('Local Next server is unavailable');
if (variant === 'after') {
  const paths = new Set(html.match(/\/_next\/static\/[^\s"<>\\]+\.(?:js|css)/g));
  for (const url of paths) {
    const file = resolve(root, url.slice('/_next/static/'.length));
    if (!file.startsWith(root + sep)) throw new Error('Static path escapes the built app');
    const original = await readFile(file);
    const encoded = await compress(original, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
    if (!brotliDecompressSync(encoded).equals(original)) throw new Error('Compression changed decoded bytes');
    compressed.set(url, { encoded, etag: '"' + createHash('sha256').update(encoded).digest('hex') + '-br"' });
  }
}
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const asset = compressed.get(pathname);
  const acceptBr = String(request.headers['accept-encoding'] ?? '').split(',').some(s => /^\s*br\s*(?:;\s*q=(?!0(?:\.0*)?\s*$)[\d.]+)?\s*$/.test(s));
  const useBr = asset && acceptBr && ['GET', 'HEAD'].includes(request.method) && !request.headers.range;
  const upstream = http.request({ hostname: '127.0.0.1', port: 3021, path: request.url, method: request.method,
    headers: { ...request.headers, ...(useBr ? { 'accept-encoding': 'identity' } : {}) } }, incoming => {
    const headers = { ...incoming.headers };
    if (useBr && incoming.statusCode === 200) {
      delete headers['transfer-encoding']; delete headers['content-length'];
      headers['content-encoding'] = 'br'; headers['content-length'] = asset.encoded.length;
      headers.vary = 'Accept-Encoding'; headers.etag = asset.etag;
      response.writeHead(200, headers);
      incoming.resume();
      response.end(request.method === 'HEAD' ? undefined : asset.encoded);
    } else { response.writeHead(incoming.statusCode, headers); incoming.pipe(response); }
  });
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  request.pipe(upstream);
});
server.listen(3020, '127.0.0.1', () => console.log(`Local ${variant} proxy; ${compressed.size} verified Brotli assets.`));
const stop = () => server.close(() => process.exit(0));
process.once('SIGINT', stop); process.once('SIGTERM', stop);
