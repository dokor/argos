import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(`${process.env.API_BASE ?? "http://api-backend:8081"}/api/audits/scope-catalogue`, {
      redirect: "error", signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    if (!response.ok) throw new Error("Catalogue unavailable");
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "catalogue_unavailable" }, { status: 503 });
  }
}
