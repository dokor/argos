import type { NextConfig } from "next";

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
  experimental: { globalNotFound: true },
  reactCompiler: true,
  async redirects() {
    return [
      { source: "/accessibilite-numerique", destination: "/ressources/accessibilite-numerique", permanent: true },
      { source: "/audit-technique-gratuit", destination: "/ressources/audit-technique-gratuit", permanent: true },
      { source: "/audit-site-pme", destination: "/ressources/audit-site-pme", permanent: true },
      { source: "/audit-site-ecommerce", destination: "/ressources/audit-site-ecommerce", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/report/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/en/report/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      { source: "/account/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/en/account/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }] },
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
