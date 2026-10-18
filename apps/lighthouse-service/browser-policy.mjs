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
    `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${new URL(proxy).hostname}`, '--disable-quic',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--disable-background-networking', '--disable-extensions', '--disable-component-update'];
}

/** Context-wide rules cover frames, workers and popups; DNS/TCP enforcement is in the proxy. */
export function navigationScope(value, initialUrl) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error('Invalid navigation scope');
  const origins = value.map(origin => {
    analysisUrl(origin);
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' || parsed.origin !== origin) throw new Error('Invalid navigation scope');
    return origin;
  });
  if (new Set(origins).size !== origins.length || !origins.includes(new URL(initialUrl).origin))
    throw new Error('Invalid navigation scope');
  return origins;
}

export async function protectContext(context, cancel, navigationOrigins) {
  const authorized = navigationOrigins ? new Set(navigationOrigins) : null;
  const pages = new WeakMap();
  let requests = 0, bytes = 0;
  const preparePage = page => {
    if (!pages.has(page)) pages.set(page, (async () => {
      page.on('download', download => { void download.cancel().catch(() => {}); });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      cdp.on('Network.dataReceived', event => {
        bytes += event.dataLength;
        if (bytes > 20 * 1024 * 1024) cancel();
      });
      if (!authorized) return;
      const { frameTree } = await cdp.send('Page.getFrameTree');
      if (typeof frameTree?.frame?.id !== 'string') throw new Error('Navigation guard unavailable');
      // Playwright routes only the first URL of a redirect chain. Pause the
      // redirect response itself, before Chromium can send the next request.
      cdp.on('Fetch.requestPaused', async event => {
        try {
          if (event.frameId === frameTree.frame.id && event.responseStatusCode >= 300 && event.responseStatusCode < 400) {
            const locations = (event.responseHeaders ?? []).filter(header => header.name.toLowerCase() === 'location');
            if (locations.length > 1) throw new Error('Ambiguous redirect');
            if (locations.length) {
              const destination = new URL(locations[0].value, event.request.url).href;
              analysisUrl(destination);
              if (!authorized.has(new URL(destination).origin)) throw new Error('Redirect outside scope');
            }
          }
          await cdp.send('Fetch.continueResponse', { requestId: event.requestId });
        } catch {
          await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
          cancel();
        }
      });
      await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', resourceType: 'Document', requestStage: 'Response' }] });
    })());
    return pages.get(page);
  };
  await context.route('**/*', async route => {
    const request = route.request();
    try {
      if (++requests > 300) { cancel(); throw new Error('Request limit'); }
      analysisUrl(request.url());
      if (authorized && request.isNavigationRequest() && !request.frame().parentFrame()) {
        if (!authorized.has(new URL(request.url()).origin)) {
          cancel();
          throw new Error('Main navigation outside scope');
        }
        // Also gates popups: asynchronous page events must not race navigation.
        await preparePage(request.frame().page());
      }
      if (!['GET','HEAD'].includes(request.method())) throw new Error('Scope limit');
      await route.continue();
    } catch { await route.abort('blockedbyclient').catch(() => {}); }
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  context.on('page', page => preparePage(page).catch(error => { cancel(error); }));
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
