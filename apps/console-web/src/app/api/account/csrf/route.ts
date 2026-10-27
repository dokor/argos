import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CSRF_COOKIE, accountCookieOptions } from "@/lib/account-proxy";
export async function GET(request: NextRequest) {
  const current = request.cookies.get(CSRF_COOKIE)?.value;
  const csrf = current && /^[A-Za-z0-9_-]{43}$/.test(current) ? current : randomBytes(32).toString("base64url");
  const response = NextResponse.json({ csrf }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(CSRF_COOKIE, csrf, accountCookieOptions(86400));
  return response;
}
