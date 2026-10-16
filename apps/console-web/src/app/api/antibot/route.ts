import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, privateError } from "@/lib/account-proxy";
export async function GET(request: NextRequest) {
  try {
    const base = process.env.API_BASE ?? "http://api-backend:8081";
    const options = { cache: "no-store" as const, redirect: "error" as const, signal: AbortSignal.timeout(8000) };
    const result = await fetch(base + "/api/antibot", options);
    if (!result.ok) return privateError("antibot_unavailable",503);
    const config = await result.json();
    if (typeof config.enabled !== "boolean" || config.enabled && typeof config.siteKey !== "string") return privateError("antibot_unavailable",503);
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (session && ["audit","feedback"].includes(request.nextUrl.searchParams.get("action") ?? "")) {
      const profile = await fetch(base + "/api/account/me", { ...options, headers: {Authorization:"Bearer " + session} });
      if (profile.ok) return NextResponse.json({enabled:false}, {headers:{"Cache-Control":"private, no-store"}});
    }
    return NextResponse.json(config.enabled ? {enabled:true,siteKey:config.siteKey} : {enabled:false}, {headers:{"Cache-Control":"private, no-store"}});
  } catch { return privateError("antibot_unavailable",503); }
}
