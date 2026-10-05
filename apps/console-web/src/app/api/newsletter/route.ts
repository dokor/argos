import { NextRequest, NextResponse } from "next/server";
import { createLogger, maskEmail, safeError } from "@/lib/logger";

const JAVA_API_BASE = process.env.API_BASE ?? "http://api-backend:8081";
const logger = createLogger("api", { route: "/api/newsletter" });

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: { email?: string };

  try {
    body = await req.json();
  } catch (error) {
    logger.warn("newsletter_bff_invalid_json", {
      action: "subscribe_newsletter",
      details: {
        durationMs: Date.now() - startedAt,
        error: safeError(error),
      },
    });
    return NextResponse.json({ status: "error", message: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body.email !== "string" || !body.email || body.email.length > 255) {
    logger.warn("newsletter_bff_missing_email", {
      action: "subscribe_newsletter",
      details: {
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${JAVA_API_BASE}/api/newsletter/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: body.email }),
      cache: "no-store",
    });

    const data = await res.json();
    if (res.ok) {
      logger.info("newsletter_bff_backend_response_ok", {
        action: "subscribe_newsletter",
        details: {
          durationMs: Date.now() - startedAt,
          email: maskEmail(body.email),
          statusCode: res.status,
        },
      });
    } else {
      logger.warn("newsletter_bff_backend_response_error", {
        action: "subscribe_newsletter",
        details: {
          durationMs: Date.now() - startedAt,
          email: maskEmail(body.email),
          statusCode: res.status,
        },
      });
    }

    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (res.status === 429 && res.headers.get("retry-after")) headers["Retry-After"] = res.headers.get("retry-after")!;
    if (res.ok || res.status === 409) {
      return NextResponse.json({ status: "ok", message: "Subscription request accepted" }, { status: 200, headers });
    }
    return NextResponse.json(data, { status: res.status, headers });
  } catch (error) {
    logger.error("newsletter_bff_backend_unreachable", {
      action: "subscribe_newsletter",
      details: {
        durationMs: Date.now() - startedAt,
        email: maskEmail(body.email),
        error: safeError(error),
      },
    });
    return NextResponse.json({ status: "error", message: "Service unavailable" }, { status: 503 });
  }
}
