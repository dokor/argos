import { createHash } from 'node:crypto';

export const EVIDENCE_LIMIT = 10;
// No path, credentials, query, fragment, HTML, attribute value or arbitrary error text
// crosses this boundary. The reference distinguishes resources without exposing paths.
export function resourceEvidence(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
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

export function lighthouseEvidence(audit) {
  const items=[], seen=new Set(); let inspected=0, truncated=false;
  function retain(item) {
    if(!item) return;
    const key=JSON.stringify(item); if(seen.has(key)) return; seen.add(key);
    if(items.length<EVIDENCE_LIMIT) items.push(item); else truncated=true;
  }
  function visit(value, depth=0) {
    if(depth>6 || inspected>=400) { truncated=true; return; }
    inspected++;
    if(!value || typeof value!=='object') return;
    if(value.type==='node') retain(nodeEvidence(value));
    if(typeof value.url==='string') retain(resourceEvidence(value.url));
    // Only known detail containers, never arbitrary audit strings or screenshot data.
    if(Array.isArray(value)) { for(const item of value) { visit(item,depth+1); if(inspected>=400) {truncated=true;break;} } }
    else for(const key of ['items','node','subItems','value','source','location']) if(Object.hasOwn(value,key)) visit(value[key],depth+1);
  }
  visit(audit?.details);
  return evidenceEnvelope('lighthouse',items,inspected,truncated);
}
