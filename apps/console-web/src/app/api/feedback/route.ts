import { boundedJson } from "@/lib/bounded-request";
import { NextRequest, NextResponse } from "next/server";
import { accountHeaders, privateError } from "@/lib/account-proxy";
import { feedbackPayload } from "@/lib/feedback-request";

export async function POST(request: NextRequest) {
  const headers = accountHeaders(request, true);
  if (headers instanceof NextResponse) return headers;
  let body: Record<string, unknown>;
  try {
    body = await boundedJson(request, 65536) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body) || !feedbackPayload(body)) return privateError("payload_invalid", 400);
  } catch { return privateError("payload_invalid", 400); }
  try {
    const upstream = await fetch((process.env.API_BASE ?? "http://api-backend:8081") + "/api/feedback", {
      method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
    const response = new NextResponse(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
    if (upstream.status === 429) response.headers.set("Retry-After", upstream.headers.get("retry-after") ?? "900");
    return response;
  } catch { return privateError("feedback_unavailable", 503); }
}
