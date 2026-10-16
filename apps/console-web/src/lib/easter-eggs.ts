import { normalizeInputUrl } from "./url";

export type UrlEasterEgg = "argos" | "google" | "wikipedia" | "github" | "amazon";

const domains: Record<Exclude<UrlEasterEgg, "argos">, readonly string[]> = {
  google: ["google.com", "google.fr", "google.co.uk", "google.de"],
  wikipedia: ["wikipedia.org"],
  github: ["github.com"],
  amazon: ["amazon.com", "amazon.fr", "amazon.co.uk", "amazon.de"],
};

/** Presentation only: never authorizes a URL, sends a request or changes an audit. */
export function urlEasterEgg(raw: string): UrlEasterEgg | undefined {
  if (!raw.trim() || raw.length > 2048) return undefined;
  try {
    const url = new URL(normalizeInputUrl(raw));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr");
    if (host === site.hostname.toLowerCase() || host === "argos.lelouet.fr") return "argos";
    for (const [key, roots] of Object.entries(domains)) {
      if (roots.some(root => host === root || host.endsWith(`.${root}`))) return key as UrlEasterEgg;
    }
  } catch { /* Incomplete input stays silent; the form retains its own validation. */ }
  return undefined;
}
