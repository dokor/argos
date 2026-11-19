import type { NextConfig } from "next";
import { PRODUCTION_SITE_URL } from "./src/lib/site-url";
import { locales } from "./src/lib/i18n/locales";

const movedPages = [
  { source: "/accessibilite-numerique", destination: "/ressources/accessibilite-numerique" },
  { source: "/audit-technique-gratuit", destination: "/ressources/audit-technique-gratuit" },
  { source: "/audit-site-pme", destination: "/ressources/audit-site-pme" },
  { source: "/audit-site-ecommerce", destination: "/ressources/audit-site-ecommerce" },
];

// En-têtes de sécurité HTTP appliqués à toutes les routes.
// Objectif : remonter le score Mozilla Observatory et réduire la surface
// XSS / clickjacking (voir issue #103).
// La CSP est générée par src/proxy.ts avec un nonce propre à chaque réponse HTML.

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // console-web has its own dependencies and lockfile, separate from root ADE tooling.
  // The config directory also resolves to /app in the console-web Docker context.
  turbopack: { root: __dirname },
  // Keep rewrites on the server's original origin (including numeric loopback hosts).
  skipProxyUrlNormalize: true,
  experimental: { globalNotFound: true },
  reactCompiler: true,
  async redirects() {
    return [
      // Run before Proxy, BFF handlers and rewrites, including /api and static files.
      // A fixed destination prevents Host-based open redirects. 308 preserves POST bodies.
      ...["argos\\.lelouet\\.fr", "www\\.argos-audit\\.com"].flatMap(host => [
        // Resolve previously moved pages in the same hop as the domain migration.
        ...movedPages.map(page => ({
          source: page.source,
          has: [{ type: "host" as const, value: host }],
          destination: PRODUCTION_SITE_URL + page.destination,
          permanent: true,
        })),
        {
          source: "/:path*",
          has: [{ type: "host" as const, value: host }],
          destination: `${PRODUCTION_SITE_URL}/:path*`,
          permanent: true,
        },
      ]),
      ...movedPages.map(page => ({ ...page, permanent: true })),
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...["account", "report", "share"].map(section => ({
        source: `/:locale(${locales.filter(locale => locale.code !== "fr").map(locale => locale.code).join("|")})/${section}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }],
      })),
      ...["account", "report", "share"].map(section => ({
        source: `/${section}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }],
      })),
    ];
  },
  async rewrites() {
    const apiBase = process.env.API_BASE ?? "http://api-backend:8081";
    return {
      // Dynamic account/admin Route Handlers must run before the generic Java proxy.
      fallback: [
        {
          source: "/api/:path*",
          destination: `${apiBase}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
