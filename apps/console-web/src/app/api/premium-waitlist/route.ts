import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE ?? "http://api-backend:8081";
const headers = { "Cache-Control": "no-store" };
const emailPattern = /^[a-zA-Z0-9_%+\-]+(?:[.][a-zA-Z0-9_%+\-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?[.])+[a-zA-Z]{2,63}$/;

export async function POST(req: NextRequest) {
  // Never log the request, address, backend body or exception (which may echo input).
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ status: "error" }, { status: 400, headers }); }
  if (!body || typeof body.email !== "string" || body.email.length > 255 || body.consent !== true || !["fr", "en"].includes(body.locale)) {
    return NextResponse.json({ status: "error" }, { status: 400, headers });
  }
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email) || email.indexOf("@") > 64) {
    return NextResponse.json({ status: "error" }, { status: 400, headers });
  }
  try {
    const response = await fetch(`${API_BASE}/api/premium-waitlist`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, consent: true, locale: body.locale }),
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return NextResponse.json({ status: "ok" }, { status: 200, headers });
    const status = [400, 429].includes(response.status) ? response.status : 503;
    const retry = response.headers.get("retry-after");
    return NextResponse.json({ status: "error" }, { status, headers: { ...headers, ...(status === 429 && retry && /^\d+$/.test(retry) ? { "Retry-After": retry } : {}) } });
  } catch { return NextResponse.json({ status: "error" }, { status: 503, headers }); }
}
