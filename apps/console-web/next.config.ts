import type { NextConfig } from "next";

// En-têtes de sécurité HTTP appliqués à toutes les routes.
// Objectif : remonter le score Mozilla Observatory et réduire la surface
// XSS / clickjacking (voir issue #103).
// Note : 'unsafe-inline' est requis pour les scripts JSON-LD injectés via
// dangerouslySetInnerHTML (layout.tsx, faq/layout.tsx) et le bootstrap Next.js.
// À resserrer ultérieurement avec une CSP à nonce (middleware).
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    const apiBase = process.env.API_BASE ?? "http://api-backend:8081";
    return {
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${apiBase}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
