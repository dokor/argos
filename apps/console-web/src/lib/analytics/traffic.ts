import { publicRoute } from "./contract";
export const trafficSources = ["direct", "search", "referral", "campaign", "internal"] as const;
export type TrafficSource = typeof trafficSources[number];
export function trafficPayload(value: unknown): {route: string; lang: "fr" | "en"; source: TrafficSource} | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(",") !== "lang,route,source" || typeof v.route !== "string" || publicRoute(v.route) !== v.route || !["fr","en"].includes(String(v.lang)) || !trafficSources.includes(v.source as TrafficSource)) return;
  return {route:v.route,lang:v.lang as "fr"|"en",source:v.source as TrafficSource};
}
/** Classification happens in the browser. Neither query values nor referrer URLs are sent. */
export function acquisition(search: string, referrer: string, origin: string): TrafficSource {
  if ([...new URLSearchParams(search).keys()].some(k => /^utm_(source|medium|campaign)$/.test(k))) return "campaign";
  if (!referrer) return "direct";
  try {const u = new URL(referrer);if(u.origin===origin)return "internal";return /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|ecosia\.org)$/.test(u.hostname) ? "search" : "referral";} catch {return "direct";}
}
