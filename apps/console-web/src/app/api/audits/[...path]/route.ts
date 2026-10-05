import { NextRequest, NextResponse } from "next/server";
import { adminReadProxy } from "@/lib/admin-read-proxy";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const suffix = path.join("/");
  if (!/^(runs\/[0-9]+|[0-9]+\/history)$/.test(suffix)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit")) || 20));
  return adminReadProxy(request, `/api/audits/${suffix}?limit=${Math.trunc(limit)}`);
}
