import { isIP } from 'node:net';

// Les suffixes composés les plus courants pour les sites ciblés par Argos. Cette
// liste volontairement compacte ne remplace pas la Public Suffix List : un suffixe
// inconnu est traité comme un TLD simple et peut donc mal classifier un domaine.
// Le cas co.uk est couvert par test (issue #247). Une couverture PSL complète doit
// être introduite si Argos élargit les pays/suffixes réellement analysés.
const COMPOUND_PUBLIC_SUFFIXES = new Set([
  'ac.uk', 'co.uk', 'gov.uk', 'ltd.uk', 'me.uk', 'net.uk', 'org.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'org.nz', 'govt.nz',
  'com.br', 'com.mx', 'com.tr', 'co.jp', 'co.in'
]);

export function registrableDomain(host) {
  const normalizedHost = String(host ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!normalizedHost || isIP(normalizedHost) || normalizedHost === 'localhost') return normalizedHost;

  const labels = normalizedHost.split('.').filter(Boolean);
  if (labels.length <= 2) return normalizedHost;

  const publicSuffix = labels.slice(-2).join('.');
  const suffixLength = COMPOUND_PUBLIC_SUFFIXES.has(publicSuffix) ? 2 : 1;
  return labels.length <= suffixLength
    ? normalizedHost
    : labels.slice(-(suffixLength + 1)).join('.');
}

export function registrableDomainForUrl(value) {
  try {
    return registrableDomain(new URL(value).hostname);
  } catch {
    return '';
  }
}

export function isFirstPartyUrl(resourceUrl, finalPageUrl) {
  const pageDomain = registrableDomainForUrl(finalPageUrl);
  const resourceDomain = registrableDomainForUrl(resourceUrl);
  return Boolean(pageDomain && resourceDomain && pageDomain === resourceDomain);
}

export function partitionNetworkErrors({ failedRequestUrls = [], status5xxUrls = [] }, finalPageUrl) {
  const countByOwnership = (urls) => urls.reduce((counts, resourceUrl) => {
    if (isFirstPartyUrl(resourceUrl, finalPageUrl)) counts.firstParty += 1;
    else counts.thirdParty += 1;
    return counts;
  }, { firstParty: 0, thirdParty: 0 });

  return {
    failedRequests: countByOwnership(failedRequestUrls),
    status5xx: countByOwnership(status5xxUrls)
  };
}
