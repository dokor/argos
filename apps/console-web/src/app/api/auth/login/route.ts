import { NextRequest, NextResponse } from "next/server";
import { createLogger, safeError } from "@/lib/logger";

const COOKIE_NAME = "argos_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours
const logger = createLogger("api", { route: "/api/auth/login" });

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let password: unknown;

  try {
    ({ password } = await request.json());
  } catch (error) {
    logger.warn("admin_login_bff_invalid_json", {
      action: "authenticate_admin",
      details: {
        durationMs: Date.now() - startedAt,
        error: safeError(error),
      },
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length === 0) {
    logger.warn("admin_login_bff_missing_password", {
      action: "authenticate_admin",
      details: {
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!expectedPassword || !adminToken) {
    logger.error("admin_login_bff_misconfigured", {
      action: "authenticate_admin",
      details: {
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (password !== expectedPassword) {
    logger.warn("admin_login_bff_rejected", {
      action: "authenticate_admin",
      details: {
        durationMs: Date.now() - startedAt,
        statusCode: 401,
      },
    });
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, adminToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  logger.info("admin_login_bff_succeeded", {
    action: "authenticate_admin",
    details: {
      durationMs: Date.now() - startedAt,
    },
  });
  return response;
}

export async function DELETE() {
  logger.info("admin_logout_bff_succeeded", {
    action: "logout_admin",
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
