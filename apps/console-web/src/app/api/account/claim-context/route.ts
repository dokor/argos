import { NextRequest, NextResponse } from "next/server";
import { claimContext, validCsrf, privateError } from "@/lib/account-proxy";
export async function POST(request: NextRequest) {
  if (!validCsrf(request)) return privateError("csrf_invalid", 403);
  try {
    const body = await request.json();
    return NextResponse.json({ runId: claimContext(request, body?.reportToken) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return privateError("payload_invalid", 400); }
}
