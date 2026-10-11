import { NextRequest, NextResponse } from "next/server";
import { safeAccountReturn } from "@/lib/account-proxy";
export async function GET(request: NextRequest) {
  return NextResponse.json({ returnTo: safeAccountReturn(request.cookies.get("argos_account_return")?.value) }, { headers: { "Cache-Control": "private, no-store" } });
}
