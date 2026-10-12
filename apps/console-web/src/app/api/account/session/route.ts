import { NextRequest, NextResponse } from "next/server";
import { accountCookieOptions, accountProxy, SESSION_COOKIE } from "@/lib/account-proxy";

/** Public navigation can check authentication without treating anonymous visits as errors. */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!request.cookies.has(SESSION_COOKIE)) return NextResponse.json({ signedIn: false }, { headers });

  // Cookie presence alone is not proof of a valid session; the backend verifies it.
  const verified = await accountProxy(request, ["me"]);
  if (!verified.ok && verified.status !== 401) return verified;

  const response = NextResponse.json({ signedIn: verified.ok }, { headers });
  for (const cookie of verified.cookies.getAll()) response.cookies.set(cookie);
  if (verified.status === 401) response.cookies.set(SESSION_COOKIE, "", accountCookieOptions(0));
  return response;
}
