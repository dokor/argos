import { analysisUrl } from './policy.mjs';

export function proxyEndpoint(value = process.env.AUDIT_EGRESS_PROXY) {
  if (!value) throw new Error('Audit egress proxy is required');
  const proxy = new URL(value);
  if (proxy.protocol !== 'http:' || proxy.username || proxy.password || !proxy.port
      || proxy.pathname !== '/' || proxy.search || proxy.hash) throw new Error('Invalid egress configuration');
  return proxy.origin;
}
export function browserFlags(proxy) {
  return [`--proxy-server=${proxy}`, '--proxy-bypass-list=<-loopback>',
    '--host-resolver-rules=MAP * ~NOTFOUND', '--disable-quic',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--disable-background-networking', '--disable-extensions', '--disable-component-update'];
}

/** Context-wide rules cover frames, workers and popups; DNS/TCP enforcement is in the proxy. */
export async function protectContext(context, cancel) {
  let requests = 0, bytes = 0;
  await context.route('**/*', async route => {
    const request = route.request();
    try {
      if (++requests > 300) { cancel(); throw new Error('Request limit'); }
      analysisUrl(request.url());
      if (!['GET','HEAD'].includes(request.method())) throw new Error('Scope limit');
      await route.continue();
    } catch { await route.abort('blockedbyclient').catch(() => {}); }
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  context.on('page', async page => {
    page.on('download', download => { void download.cancel(); });
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      cdp.on('Network.dataReceived', event => {
        bytes += event.dataLength;
        if (bytes > 20 * 1024 * 1024) cancel();
      });
    } catch (error) { cancel(error); }
  });
}
export function safeOrigin(value) { try { return new URL(value).origin; } catch { return '[invalid URL]'; } }

/** Bound and redact site-supplied diagnostic strings before returning a collector result. */
export function redactDiagnostics(value, depth = 0) {
  if (depth > 30) return '[truncated]';
  if (typeof value === 'string') return value.slice(0,4000)
    .replace(/https?:\/\/[^\s<>"}\]]+/gi, url => safeOrigin(url))
    .replace(/(?:bearer\s+\S+|(?:token|password|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+|nonce-[^'\s;]+)/gi,'[redacted]');
  if (Array.isArray(value)) return value.map(item=>redactDiagnostics(item,depth+1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key])=>!['body','headers','cookies','set-cookie','authorization','samples','screenshot-thumbnails','final-screenshot'].includes(key.toLowerCase()))
    .map(([key,item])=>[key,redactDiagnostics(item,depth+1)]));
  return value;
}
