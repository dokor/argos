import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "argos_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!expectedPassword || !adminToken) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (password !== expectedPassword) {
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
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
