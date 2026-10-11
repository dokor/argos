import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const expected = Buffer.from(process.env.ADMIN_TOKEN ?? "");
  const supplied = Buffer.from(request.cookies.get("argos_admin")?.value ?? "");
  const isAdmin = expected.length > 0 && supplied.length === expected.length
    && timingSafeEqual(supplied, expected);
  return NextResponse.json({ isAdmin }, { headers: { "Cache-Control": "private, no-store" } });
}
