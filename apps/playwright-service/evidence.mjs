import { createHash } from 'node:crypto';

export const EVIDENCE_LIMIT = 10;
// No path, credentials, query, fragment, HTML, attribute value or arbitrary error text
// crosses this boundary. The reference distinguishes resources without exposing paths.
export function resourceEvidence(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin.length > 512) return null;
    return {kind:'resource', origin:url.origin,
      resourceRef:createHash('sha256').update(url.origin + url.pathname).digest('hex').slice(0,16)};
  } catch { return null; }
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
