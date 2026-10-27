import { createHash } from 'node:crypto';

export const EVIDENCE_LIMIT = 10;
// Only static resource paths are retained, never application routes, query values or error text.
export function safeResourcePath(path) {
  if (path === '/') return path;
  if (typeof path !== 'string' || path.length > 1024 || !path.startsWith('/') || path.startsWith('//')) return null;
  let decoded; try { decoded = decodeURIComponent(path); } catch { return null; }
  if (!/^\/[a-zA-Z0-9/_.~!$&()+,;=% -]+$/.test(path) || /[\\%?#@<>\u0000-\u001f\u007f]/.test(decoded)
      || /(?:token|secret|password|passwd|session|authorization|api[_-]?key|private|customer|email)/i.test(decoded)
      || decoded.split('/').some(segment => segment === '..' || segment === '.' || segment.length > 100 || /\d{7,}/.test(segment))) return null;
  return /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)(?:;[^/]*)?$/i.test(decoded) ? path : null;
}
export function resourceEvidence(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin.length > 512) return null;
    const resourcePath = safeResourcePath(url.pathname);
    return {kind:'resource', origin:url.origin, ...(resourcePath ? {resourcePath} : {}),
      resourceRef:createHash('sha256').update(url.origin + url.pathname).digest('hex').slice(0,16)};
  } catch { return null; }
}
export function scriptEvidence(url, line, column, pageUrl, zeroBased = true) {
  const resource = resourceEvidence(url);
  if (!resource) return null;
  const metrics = {};
  for (const [key,value] of [['sourceLine',line],['sourceColumn',column]])
    if (Number.isSafeInteger(value) && value >= (zeroBased ? 0 : 1) && value < 1e7) metrics[key] = value + (zeroBased ? 1 : 0);
  let locationScope;
  try { const a = new URL(url), b = new URL(pageUrl); if(a.origin === b.origin && a.pathname === b.pathname && a.search === b.search) locationScope = 'ANALYSED_DOCUMENT'; } catch { /* No document attribution. */ }
  const resourceType=locationScope?'document':/\.(?:png|jpe?g|gif|svg|webp|avif|ico)$/i.test(resource.resourcePath??'')?'image':/\.(?:js|mjs)$/i.test(resource.resourcePath??'')?'script':'other';
  return {...resource, resourceType, ...(locationScope ? {locationScope} : {}), ...(Object.keys(metrics).length ? {metrics} : {})};
}
export function exceptionEvidence(error, pageUrl) {
  const stack = typeof error?.stack === 'string' ? error.stack.slice(0,8192) : '';
  // Parse only source coordinates from stack frames; discard messages, function names and snippets.
  for (const line of stack.split('\n').slice(1,11)) {
    const match = line.match(/\bat (?:.*?\()?((?:https?):\/\/[^\s()]+):(\d{1,7}):(\d{1,7})\)?$/);
    if (!match) continue;
    const item = scriptEvidence(match[1], Number(match[2]), Number(match[3]), pageUrl, false);
    if (item) return item;
  }
  return null;
}
export function nodeEvidence(node) {
  const path = node?.path;
  // Lighthouse's observed DOM path contains only sibling indexes and tag names.
  // IDs, classes, selectors and snippets can contain private data: never retain them.
  return typeof path === 'string' && path.length <= 512 && /^(?:[0-9]{1,5},[A-Z][A-Z0-9-]{0,31})(?:,[0-9]{1,5},[A-Z][A-Z0-9-]{0,31})*$/.test(path)
    ? {kind:'element', nodePath:path} : null;
}
export function evidenceEnvelope(source, items, inspected, truncated=false) {
  return {version:'observed-evidence-v1', source, state:items.length ? 'AVAILABLE':'UNAVAILABLE',
    items:items.slice(0,EVIDENCE_LIMIT), inspected, truncated:truncated || items.length>EVIDENCE_LIMIT, redacted:true};
}
