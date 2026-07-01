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

  if (!body.email) {
    logger.warn("newsletter_bff_missing_email", {
      action: "subscribe_newsletter",
      details: {
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });
  }

  // Forward IP hint from the original client (best effort)
  const ipHint = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined;

  try {
    const res = await fetch(`${JAVA_API_BASE}/api/newsletter/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ipHint ? { "X-Forwarded-For": ipHint } : {}),
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

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[newsletter] BFF error:", error);
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
