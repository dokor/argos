import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "@/lib/content-security-policy";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(32).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  // Overwrite untrusted client headers. Next.js reads this policy to nonce its bootstrap.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  // HTML and its nonce must never be reused for a different response.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/|favicon.ico|apple-touch-icon.png|og.png|robots.txt|sitemap.xml|manifest.json|llms.txt).*)"],
};
