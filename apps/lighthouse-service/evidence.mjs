import { createHash } from 'node:crypto';

export const EVIDENCE_LIMIT = 10;
// Actionable locations are an additive, bounded allowlist. Never retain query strings,
// credentials, attribute selectors or page text. Old origin/ref-only reports remain valid.
export function safeResourcePath(path) {
  if (path === '/' || path === '/robots.txt') return path; // Known public root resources only.
  if (typeof path !== 'string' || path.length > 1024 || !path.startsWith('/') || path.startsWith('//')) return null;
  let decoded; try { decoded = decodeURIComponent(path); } catch { return null; }
  if (!/^\/[a-zA-Z0-9/_.~!$&()+,;=% -]+$/.test(path) || /[\\\\%?#@<>\u0000-\u001f\u007f]/.test(decoded)
      || /(?:token|secret|password|passwd|session|authorization|api[_-]?key|private|customer|email)/i.test(decoded)
      || decoded.split('/').some(segment => segment === '..' || segment === '.' || segment.length > 100 || /\d{7,}/.test(segment))) return null;
  // Static file paths only: application routes and user identifiers stay hidden.
  return /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)(?:;[^/]*)?$/i.test(decoded) ? path : null;
}
export function safeSelector(value) {
  if (typeof value !== 'string' || value.length > 512
      || /(?:token|secret|password|session|customer|email|private|\d{7,})/i.test(value)) return null;
  return /^(?:[a-zA-Z][a-zA-Z0-9-]*(?:[.#][a-zA-Z_][a-zA-Z0-9_-]{0,63})*(?::nth-(?:child|of-type)\([1-9][0-9]{0,4}\))?)(?:\s*>\s*(?:[a-zA-Z][a-zA-Z0-9-]*(?:[.#][a-zA-Z_][a-zA-Z0-9_-]{0,63})*(?::nth-(?:child|of-type)\([1-9][0-9]{0,4}\))?))*$/.test(value) ? value : null;
}
export const METRIC_KEYS = ['totalBytes', 'wastedBytes', 'wastedMs', 'transferSize', 'resourceSize', 'duration', 'width', 'height', 'navStartToEndTime', 'startTime', 'reflowTime', 'mainThreadTime', 'layoutShiftScore'];
function metrics(value) {
  return Object.fromEntries(METRIC_KEYS.filter(key => typeof value?.[key] === 'number'
    && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1e12).map(key => [key, value[key]]));
}
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
  // The structural path is separate from the allowlisted selector used for navigation.
  return typeof path === 'string' && path.length <= 512 && /^(?:[0-9]{1,5},[A-Za-z][A-Za-z0-9-]{0,31})(?:,[0-9]{1,5},[A-Za-z][A-Za-z0-9-]{0,31})*$/.test(path)
    ? {kind:'element', nodePath:path} : null;
}
export function evidenceEnvelope(source, items, inspected, truncated=false) {
  return {version:'observed-evidence-v1', source, state:items.length ? 'AVAILABLE':'UNAVAILABLE',
    items:items.slice(0,EVIDENCE_LIMIT), inspected, truncated:truncated || items.length>EVIDENCE_LIMIT, redacted:true};
}

export function attachLinkNodes(result) {
  const rows = result?.lhr?.audits?.['link-text']?.details?.items;
  const anchors = result?.artifacts?.AnchorElements;
  if (!Array.isArray(rows) || !Array.isArray(anchors)) return;
  const used = new Set();
  for (const row of rows.slice(0,EVIDENCE_LIMIT)) {
    const index = anchors.findIndex((a,i)=> !used.has(i) && a.href === row.href && typeof a.text === 'string' && a.text.trim() === row.text);
    if (index >= 0 && anchors[index].node) { row.node = {...anchors[index].node, type:'node'}; used.add(index); }
  }
}

export function lighthouseEvidence(audit, pageUrl, auditId = audit?.id) {
  const items=[], seen=new Set(); let inspected=0, truncated=false;
  const urlColumns=new Set(['url']);
  function retain(item) {
    if(!item) return;
    const key=JSON.stringify(item); if(seen.has(key)) return; seen.add(key);
    if(items.length<EVIDENCE_LIMIT) items.push(item); else truncated=true;
  }
  function visit(value, depth=0, rowMetrics={}) {
    if(depth>12 || inspected>=400) { truncated=true; return; }
    inspected++;
    if(!value || typeof value!=='object') return;
    if(value.type==='link') return; // Documentation links are not affected site resources.
    // This table includes healthy scripts too. Only rows with a diagnostic belong
    // in the finding; otherwise a passing bundle is presented as needing repair.
    if(auditId==='valid-source-maps'&&typeof value.scriptUrl==='string'&&!value.subItems?.items?.length) return;
    for(const heading of (Array.isArray(value.headings)?value.headings:[]).slice(0,30)) {
      for(const column of [heading,heading.subItemsHeading]) if(column?.valueType==='url'&&/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(column.key??'')) urlColumns.add(column.key);
    }
    const measured = {...rowMetrics,...metrics(value)};
    if(['cls-culprits-insight','layout-shifts'].includes(auditId)&&typeof value.score==='number'&&value.score>=0&&value.score<=100) measured.layoutShiftScore=value.score;
    if(auditId==='bootup-time'&&typeof value.total==='number'&&value.total>=0&&value.total<=1e12) measured.duration=value.total;
    if(value.type==='node') {
      const node = nodeEvidence(value);
      const selector = safeSelector(value.selector);
      // Only attribute names, never their values, page text or arbitrary axe prose.
      const attributes=[...new Set((String(value.explanation??'').slice(0,4000).match(/\baria-[a-z-]{1,32}\b/g)??[])
        .filter(name=>!/(?:secret|token|password|private|customer|email)/.test(name)))].slice(0,10);
      if (node || selector) retain({...node, kind:'element', ...(selector ? {selector} : {}), ...(attributes.length?{attributes}:{}), ...(Object.keys(measured).length?{metrics:measured}:{})});
    }
    const url = typeof value.url==='string' ? value.url : value.type==='url' && typeof value.value==='string' ? value.value : null;
    if(url) {
      const resource = resourceEvidence(url);
      const path = resource && safeResourcePath(new URL(url).pathname);
      let locationScope;
      try { const a = new URL(url), b = new URL(pageUrl); if(a.origin === b.origin && a.pathname === b.pathname && a.search === b.search) locationScope = 'ANALYSED_DOCUMENT'; } catch { /* Not the measured document. */ }
      // Lighthouse source-location coordinates are zero-based; display coordinates are one-based.
      if (value.type === 'source-location') for (const key of ['line', 'column']) {
        if (Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] < 1e7)
          measured[key === 'line' ? 'sourceLine' : 'sourceColumn'] = value[key] + 1;
      }
      if (resource) retain({...resource, ...(path ? {resourcePath:path} : {}), ...(locationScope ? {locationScope,resourceType:'document'} : {}),
        ...(Object.keys(measured).length ? {metrics:measured} : {})});
    }
    // Only known detail containers, never arbitrary audit strings or screenshot data.
    if(Array.isArray(value)) { for(const [index,item] of value.entries()) { visit(item,depth+1,auditId==='redirects'&&depth===1?{navigationStep:index+1}:{}); if(inspected>=400) {truncated=true;break;} } }
    else {
      for(const key of urlColumns) if(key!=='url'&&typeof value[key]==='string') visit({type:'url',value:value[key]},depth+1,measured);
      for(const key of ['items','node','relatedNode','extra','subItems','value','source','location','sourceLocation','callFrame','url']) if(Object.hasOwn(value,key))
        visit(value[key],depth+1,['node','source','location','sourceLocation','callFrame'].includes(key)?measured:{});
      // Network trees use request-id keyed dictionaries, not the table's `items` array.
      for (const key of ['chains', 'children']) if (value[key] && typeof value[key] === 'object') {
        for (const child of Object.values(value[key])) {
          visit(child, depth + 1);
          if (inspected >= 400) { truncated = true; break; }
        }
      }
    }
  }
  visit(audit?.details);
  // This audit reports line indexes instead of URL cells. Its gatherer reads the
  // origin's /robots.txt; never mistake those coordinates for lines in the page.
  if(auditId==='robots-txt') {
    let url; try {url=new URL('/robots.txt',pageUrl).href;} catch { /* Historical URL absent. */ }
    if(url) for(const row of (audit?.details?.items??[]).slice(0,EVIDENCE_LIMIT)) {
      const line=Number(row.index);
      if(Number.isSafeInteger(line)&&line>0&&line<1e7) retain({...resourceEvidence(url),resourcePath:'/robots.txt',metrics:{sourceLine:line}});
    }
  }
  return evidenceEnvelope('lighthouse',items,inspected,truncated);
}
