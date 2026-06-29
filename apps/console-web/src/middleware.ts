import { NextRequest, NextResponse } from "next/server";

// Reports are public — access is controlled by the opaque token in the URL.
// Only the admin dashboard requires authentication.
const PROTECTED_PATHS = ["/dashboard"];
const COOKIE_NAME = "argos_admin";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
