import { NextRequest, NextResponse } from "next/server";

const JAVA_API_BASE = process.env.API_BASE ?? "http://api-backend:8081";

export async function POST(req: NextRequest) {
  let body: { email?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });
  }

  // Forward IP hint from the original client (best effort)
  const ipHint = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined;

  try {
    const res = await fetch(`${JAVA_API_BASE}/api/newsletter/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ipHint ? { "X-Forwarded-For": ipHint } : {}),
      },
      body: JSON.stringify({ email: body.email }),
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[newsletter] BFF error:", err);
    return NextResponse.json({ status: "error", message: "Service unavailable" }, { status: 503 });
  }
}
