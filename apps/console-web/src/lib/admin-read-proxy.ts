import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function adminReadProxy(request: NextRequest, path: string): Promise<NextResponse> {
  const expected = process.env.ADMIN_TOKEN;
  const cookie = request.cookies.get("argos_admin")?.value;
  const left = Buffer.from(cookie ?? "");
  const right = Buffer.from(expected ?? "");
  if (!expected || !cookie || left.length !== right.length || !timingSafeEqual(left, right)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const credential = process.env.ADMIN_API_TOKEN;
  if (!credential) {
    return NextResponse.json({ error: "Admin service unavailable" }, { status: 503 });
  }
  try {
    const response = await fetch(`${process.env.API_BASE ?? "http://api-backend:8081"}${path}`, {
      headers: { Authorization: `Bearer ${credential}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }
}
