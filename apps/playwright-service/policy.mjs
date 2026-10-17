import { BlockList, isIP } from 'node:net';
import { Resolver } from 'node:dns/promises';

// Conservative public-unicast policy. Transition/tunnel IPv6 is excluded.
const denied = new BlockList();
for (const [ip, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],
  ['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],
  ['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],
  ['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])
  denied.addSubnet(ip, bits, 'ipv4');
for (const [ip,bits] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])
  denied.addSubnet(ip,bits,'ipv6');
const global6 = new BlockList(); global6.addSubnet('2000::',3,'ipv6');

export function publicAddress(ip) {
  const family = isIP(ip);
  return family === 4 ? !denied.check(ip,'ipv4') : family === 6
    && global6.check(ip,'ipv6') && !denied.check(ip,'ipv6');
}

export function analysisUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2048
      || /[\s\\\u0000-\u001f\u007f]/u.test(value) || /%(?![a-f0-9]{2})/i.test(value)) throw new Error('Invalid URL');
  const url = new URL(value);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password
      || url.port || url.hostname.endsWith('.') || url.hostname.includes('%')) throw new Error('Invalid URL');
  const host = url.hostname.replace(/^\[|\]$/g,'');
  if (isIP(host)) { if (!publicAddress(host)) throw new Error('Target blocked'); }
  else if (host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/i.test(host)
      || /(?:^|\.)(?:localhost|local|internal|localdomain|test|invalid|example|onion)$/i.test(host))
    throw new Error('Target blocked');
  // Reject noncanonical IP spellings (WHATWG silently rewrites these).
  const authority = value.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  if (!authority || /[^\x00-\x7f]|%/.test(authority) || authority.endsWith(':') || authority.includes('@')
      || /:(?!80$|443$)\d+$/.test(authority)
      || (isIP(host) === 4 && authority.replace(/:(80|443)$/,'') !== host)) throw new Error('Invalid URL');
  return url;
}

async function resolveAll(host) {
  const resolver = new Resolver({ timeout: 1500, tries: 2 });
  try {
    const families = await Promise.all([resolver.resolve4(host), resolver.resolve6(host)]
      .map(query => query.catch(error => { if (error.code === 'ENODATA') return []; throw error; })));
    return families.flat().map(address => ({ address }));
  } finally { resolver.cancel(); }
}

export async function resolveTarget(url, resolve = resolveAll) {
  const host = url.hostname.replace(/^\[|\]$/g,'');
  const answers = isIP(host) ? [{ address: host }] : await resolve(host,{all:true,verbatim:true});
  if (!answers.length || answers.some(a => !publicAddress(a.address))) throw new Error('Target blocked');
  // The caller must connect to this literal, never resolve host again.
  return answers[0].address;
}
