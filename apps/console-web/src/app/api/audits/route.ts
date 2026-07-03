/**
 * BFF validation layer for POST /api/audits.
 *
 * This Next.js route takes priority over the next.config.ts afterFiles rewrite,
 * intercepting audit creation requests to validate the URL before proxying to
 * the Java backend.
 *
 * GET /api/audits (list) is also proxied here so the rewrite remains consistent.
 */

import { NextRequest, NextResponse } from "next/server";
import { createLogger, safeError, sanitizeText, sanitizeUrl } from "@/lib/logger";

const API_BASE = process.env.API_BASE ?? "http://api-backend:8081";
const logger = createLogger("api", { route: "/api/audits" });

const MAX_URL_LENGTH = 2048;

// Only http and https are accepted.
const ALLOWED_SCHEMES = /^https?:\/\//i;

// Hostnames that map to internal/private resources.
const BLOCKED_HOSTNAME = /^(localhost|.*\.local|.*\.internal|.*\.localhost|.*\.localdomain)$/i;

// Private IPv4 ranges (loopback, link-local, RFC-1918, AWS metadata).
const PRIVATE_IPV4 =
  /^(127\.|169\.254\.|10\.|172\.(1[6-9]|2[0-9]|30|31)\.|192\.168\.|0\.0\.0\.0)/;

// Private/loopback IPv6.
const PRIVATE_IPV6 = /^(::1$|::$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)/i;

/**
 * Returns an error message if the URL targets a private/internal resource,
 * or null if it looks safe.
 */
function ssrfError(raw: string): string | null {
  let parsed: URL;
  try {
    // Prepend https:// when the user omitted the scheme (same logic as backend).
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(raw)
      ? raw
      : `https://${raw}`;
    parsed = new URL(withScheme);
  } catch {
    return "Invalid URL format";
  }

  const scheme = parsed.protocol.replace(/:$/, "");
  if (!ALLOWED_SCHEMES.test(parsed.href)) {
    return `Scheme '${scheme}' is not allowed - only http and https are accepted`;
  }

  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAME.test(host)) {
    return "Internal or local hostnames are not allowed";
  }

  if (PRIVATE_IPV4.test(host)) {
    return "Private IPv4 addresses are not allowed";
  }

  // IPv6 literals are wrapped in brackets by the URL parser; strip them.
  const bare = host.startsWith("[") ? host.slice(1, -1) : host;
  if (PRIVATE_IPV6.test(bare)) {
    return "Private IPv6 addresses are not allowed";
  }

  return null;
}

/** Sanitizes a string for safe logging (prevents CRLF injection). */
function sanitize(s: string): string {
  return sanitizeText(s) ?? "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  logger.info("audit_bff_request_received", {
    action: "create_audit",
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn("audit_bff_invalid_json", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    logger.warn("audit_bff_invalid_payload_type", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const { url } = body as Record<string, unknown>;
  if (typeof url !== "string" || url.trim() === "") {
    logger.warn("audit_bff_missing_url", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ error: "Field 'url' is required" }, { status: 400 });
  }

  const trimmed = url.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    logger.warn("audit_bff_url_too_long", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
        url: sanitizeUrl(trimmed),
      },
    });
    return NextResponse.json(
      { error: `URL must not exceed ${MAX_URL_LENGTH} characters` },
      { status: 400 }
    );
  }

  const err = ssrfError(trimmed);
  if (err) {
    console.warn("[BFF] Blocked audit request:", sanitize(trimmed), "-", err);
    logger.warn("audit_bff_request_blocked", {
      action: "validate_url",
      details: {
        durationMs: Date.now() - startedAt,
        reason: err,
        url: sanitizeUrl(trimmed),
      },
    });
    return NextResponse.json({ error: err }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_BASE}/api/audits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });
  } catch (error) {
    console.error("[BFF] Backend unreachable:", error);
    logger.error("audit_bff_backend_unreachable", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
        error: safeError(error),
        url: sanitizeUrl(trimmed),
      },
    });
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const text = await backendRes.text();
  if (backendRes.ok) {
    logger.info("audit_bff_backend_response_ok", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
        statusCode: backendRes.status,
        url: sanitizeUrl(trimmed),
      },
    });
  } else {
    logger.warn("audit_bff_backend_response_error", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
        statusCode: backendRes.status,
        url: sanitizeUrl(trimmed),
      },
    });
  }

  return new NextResponse(text, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}

// Proxy the list endpoint so this route file doesn't shadow the rewrite for GETs.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const limit = request.nextUrl.searchParams.get("limit") ?? "50";
  const safeLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_BASE}/api/audits?limit=${safeLimit}`, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[BFF] Backend unreachable:", error);
    logger.error("audit_list_bff_backend_unreachable", {
      action: "list_audits",
      details: {
        durationMs: Date.now() - startedAt,
        error: safeError(error),
        limit: safeLimit,
      },
    });
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const text = await backendRes.text();
  if (backendRes.ok) {
    logger.info("audit_list_bff_response_ok", {
      action: "list_audits",
      details: {
        durationMs: Date.now() - startedAt,
        limit: safeLimit,
        statusCode: backendRes.status,
      },
    });
  } else {
    logger.warn("audit_list_bff_response_error", {
      action: "list_audits",
      details: {
        durationMs: Date.now() - startedAt,
        limit: safeLimit,
        statusCode: backendRes.status,
      },
    });
  }

  return new NextResponse(text, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
