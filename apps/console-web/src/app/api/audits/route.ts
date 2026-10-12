import { ssrfError } from "@/lib/audit-url-validation";
import { boundedJson } from "@/lib/bounded-request";
/**
 * BFF validation layer for POST /api/audits.
 *
 * This Next.js route takes priority over the next.config.ts fallback rewrite,
 * intercepting audit creation requests to validate the URL before proxying to
 * the Java backend.
 *
 * GET /api/audits (list) is also proxied here so the rewrite remains consistent.
 */

import { attribution, count } from "@/lib/analytics/server";
import { NextRequest, NextResponse } from "next/server";
import { adminReadProxy } from "@/lib/admin-read-proxy";
import { accountHeaders, SESSION_COOKIE, saveRunProof } from "@/lib/account-proxy";
import { createLogger, safeError, sanitizeUrl } from "@/lib/logger";

const API_BASE = process.env.API_BASE ?? "http://api-backend:8081";
const logger = createLogger("api", { route: "/api/audits" });

const MAX_URL_LENGTH = 2048;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const personal = request.cookies.has(SESSION_COOKIE) ? accountHeaders(request, true) : null;
  if (personal instanceof NextResponse) return personal;
  const startedAt = Date.now();
  logger.info("audit_bff_request_received", {
    action: "create_audit",
  });

  let body: unknown;
  try {
    body = await boundedJson(request);
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
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

  const { url, sourceRoute, lang } = body as Record<string, unknown>;
  if ((body as Record<string,unknown>).personal === true && !request.cookies.has(SESSION_COOKIE)) return NextResponse.json({error:"session_invalid"},{status:401,headers:{"Cache-Control":"private, no-store"}});
  const analytics = attribution(request,{route:sourceRoute,lang,placement:"form"});
  const rejected=async(errorCategory:"validation"|"service"|"rate_limit")=>{if(analytics)await count({event:"audit_submission_rejected",dimensions:analytics,errorCategory});};
  // A fixed allowlist keeps untrusted values out of structured logs.
  const auditSource = sourceRoute === "/guides/checklist-audit-site-web"
    ? sourceRoute
    : undefined;
  if (typeof url !== "string" || url.trim() === "") {
    logger.warn("audit_bff_missing_url", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
      },
    });
    await rejected("validation");
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
    await rejected("validation");
    return NextResponse.json(
      { error: `URL must not exceed ${MAX_URL_LENGTH} characters` },
      { status: 400 }
    );
  }

  const err = ssrfError(trimmed);
  if (err) {
    logger.warn("audit_bff_request_blocked", {
      action: "validate_url",
      details: {
        durationMs: Date.now() - startedAt,
        reason: err,
        url: sanitizeUrl(trimmed),
      },
    });
    await rejected("validation");
    return NextResponse.json({ error: err }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_BASE}/api/audits`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", ...(analytics ? {Authorization:"Bearer "+process.env.ADMIN_API_TOKEN} : {}),
        ...(personal ? { "X-Argos-Account-Session": personal.get("Authorization") ?? "", Origin: personal.get("Origin") ?? "",
          "X-Argos-CSRF": personal.get("X-Argos-CSRF") ?? "", Cookie: personal.get("Cookie") ?? "" } : {}) },
      body: JSON.stringify({ url: trimmed, ...(analytics ? {analytics} : {}) }),
    });
  } catch (error) {
    logger.error("audit_bff_backend_unreachable", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
        error: safeError(error),
        url: sanitizeUrl(trimmed),
      },
    });
    await rejected("service");
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const text = await backendRes.text();
  if(!backendRes.ok)await rejected(backendRes.status===429?"rate_limit":backendRes.status<500?"validation":"service");
  if (backendRes.ok) {
    logger.info("audit_bff_backend_response_ok", {
      action: "create_audit",
      details: {
        durationMs: Date.now() - startedAt,
        statusCode: backendRes.status,
        url: sanitizeUrl(trimmed),
        ...(auditSource ? { sourceRoute: auditSource } : {}),
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

  const response = new NextResponse(text, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store",
      ...(backendRes.status === 429 && backendRes.headers.get("retry-after") ? { "Retry-After": backendRes.headers.get("retry-after")! } : {}) },
  });
  const proof = backendRes.headers.get("x-argos-run-proof");
  if (backendRes.ok && proof) {
    try { const created = JSON.parse(text); saveRunProof(request, response, String(created.runId), created.reportToken, proof); } catch { /* Invalid upstream response cannot issue a proof. */ }
  }
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limit = request.nextUrl.searchParams.get("limit") ?? "50";
  const safeLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  return adminReadProxy(request, `/api/audits?limit=${safeLimit}`);
}
