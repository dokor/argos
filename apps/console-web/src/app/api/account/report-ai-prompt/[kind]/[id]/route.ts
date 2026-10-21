import { NextRequest, NextResponse } from "next/server";
import { accountProxy, privateError, SESSION_COOKIE } from "@/lib/account-proxy";
import { buildReportAiPrompt } from "@/components/report/buildAiCorrectionPrompt";
import type { Report } from "@/components/report/types";

type Context = { params: Promise<{ kind: string; id: string }> };

/** Entitlement and report access are checked with the current session, never client input. */
export async function GET(request: NextRequest, context: Context) {
  const { kind, id } = await context.params;
  if (request.nextUrl.searchParams.size || !["run", "report", "shared"].includes(kind)
    || !(kind === "run" ? /^[1-9]\d{0,18}$/ : /^[A-Za-z0-9_-]{20,512}$/).test(id)) {
    return privateError("payload_invalid", 400);
  }
  if (!request.cookies.has(SESSION_COOKIE)) return privateError("session_invalid", 401);
  try {
    const usage = await accountProxy(request, ["usage"]);
    if (!usage.ok) return usage;
    if ((await usage.json()).offer !== "PREMIUM") return privateError("premium_required", 403);
    const path = kind === "run" ? ["runs", id, "report"] : [kind === "shared" ? "shared-reports" : "reports", id];
    const response = await accountProxy(request, path);
    if (!response.ok) return response;
    const report = await response.json() as Report;
    if (report.access === "summary") return privateError("resource_unavailable", 403);
    if (!report.scores || !report.summary || !Array.isArray(report.issues) || typeof report.domain !== "string") {
      return privateError("account_unavailable", 503);
    }
    const lang = request.headers.get("accept-language") === "en" ? "en" : "fr";
    return NextResponse.json({ prompt: buildReportAiPrompt(report, lang) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return privateError("account_unavailable", 503);
  }
}
