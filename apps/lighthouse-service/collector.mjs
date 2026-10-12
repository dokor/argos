import { proxyEndpoint, browserFlags, protectContext } from './browser-policy.mjs';

// The abort signal kills the actual Chrome process; expiry alone is not cancellation.
export function createLighthouseCollector({ launch, lighthouse, chromeFlags, chromePath, chromium, connectPuppeteer, proxy = process.env.AUDIT_EGRESS_PROXY }) {
  return async (url, { signal, timeoutMs = 60000 } = {}) => {
    let chrome, cleanup, puppeteerBrowser;
    const close = () => {
      if (chrome && !cleanup) cleanup = Promise.resolve().then(() => chrome.kill());
      return cleanup ?? Promise.resolve();
    };
    const cancel = () => { void close().catch(() => {}); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      if (signal?.aborted) throw new Error('Analysis timeout');
      const endpoint = proxyEndpoint(proxy);
      chrome = await launch({ chromePath, chromeFlags: [...chromeFlags, ...browserFlags(endpoint)], port: 9222, connectionPollInterval: 100,
        maxConnectionRetries: Math.max(1, Math.ceil(Math.min(10000, timeoutMs) / 100)) });
      if (signal?.aborted) throw new Error('Analysis timeout');
      // Install before Lighthouse navigates. New pages inherit the context-wide rules.
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
      const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
      await protectContext(context, cancel);
      const page = await context.newPage();
      // Pass Lighthouse the already protected incognito page rather than allowing
      // it to create a page in Chrome's unprotected default context.
      await page.goto('about:blank#argos-lighthouse');
      puppeteerBrowser = await connectPuppeteer({ browserURL: `http://127.0.0.1:${chrome.port}` });
      const protectedPage = (await puppeteerBrowser.pages()).find(candidate => candidate.url() === 'about:blank#argos-lighthouse');
      if (!protectedPage) throw new Error('Protected Lighthouse page unavailable');
      if (signal?.aborted) throw new Error('Analysis timeout');
      return await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error',
        locale: 'fr', maxWaitForLoad: Math.min(45000, timeoutMs) }, undefined, protectedPage);
    } finally {
      signal?.removeEventListener('abort', cancel);
      try { await puppeteerBrowser?.disconnect(); }
      finally { await close(); }
    }
  };
}
