// The abort signal kills the actual Chrome process; expiry alone is not cancellation.
export function createLighthouseCollector({ launch, lighthouse, chromeFlags, chromePath }) {
  return async (url, { signal, timeoutMs = 60000 } = {}) => {
    let chrome, cleanup;
    const close = () => {
      if (chrome && !cleanup) cleanup = Promise.resolve(chrome.kill());
      return cleanup ?? Promise.resolve();
    };
    const cancel = () => { void close().catch(() => {}); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      if (signal?.aborted) throw new Error('Analysis timeout');
      chrome = await launch({ chromePath, chromeFlags, connectionPollInterval: 100,
        maxConnectionRetries: Math.max(1, Math.ceil(Math.min(10000, timeoutMs) / 100)) });
      if (signal?.aborted) throw new Error('Analysis timeout');
      return await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error',
        locale: 'fr', maxWaitForLoad: Math.min(45000, timeoutMs) });
    } finally {
      signal?.removeEventListener('abort', cancel);
      await close();
    }
  };
}
