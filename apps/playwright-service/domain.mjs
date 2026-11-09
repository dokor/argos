import { isIP } from 'node:net';
import { getDomain } from 'tldts';

export function registrableDomain(host) {
  const normalizedHost = String(host ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!normalizedHost || isIP(normalizedHost) || normalizedHost === 'localhost') return normalizedHost;

  // Include private PSL entries so separate hosted tenants (e.g. github.io)
  // are not attributed to each other. URL parsing stays with the WHATWG parser.
  return getDomain(normalizedHost, { allowPrivateDomains: true, extractHostname: false }) ?? normalizedHost;
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
