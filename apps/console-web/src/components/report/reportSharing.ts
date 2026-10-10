import { parseReading, readingUrl } from './reportReading';
export function validContact(value: string): string | undefined {
  try { const url = new URL(value); if (/[\r\n]/.test(decodeURIComponent(value)) || url.username || url.password) return;
    if (url.protocol === 'https:' && url.hostname) return url.href;
    if (url.protocol === 'mailto:' && /^[^?@\s]+@[^?@\s]+\.[^?@\s]+$/.test(url.pathname) && !url.search && !url.hash) return url.href;
  } catch {} return;
}
export function reportShareUrl(current: string): string {
  const url = new URL(current); if (!/^\/(en\/)?report\/[A-Za-z0-9_-]+$/.test(url.pathname)) throw new Error('Not a report');
  const reading = parseReading(url.search + url.hash);
  const anchor = /^finding-(?:[a-f0-9]+-)*[a-f0-9]+$/.test(reading.anchor) ? reading.anchor : '';
  return url.origin + readingUrl(url.pathname, {...reading, anchor});
}
