/** Public origin only: safe to import in both server and client components. */
export const PRODUCTION_SITE_URL = "https://argos-audit.com";

// NEXT_PUBLIC_* is baked into the client build; Docker must supply it at build time.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE_URL).replace(/\/+$/, "");
