import { overviewQuery } from "./overview-request";
import { domainSummaryPath, domainSummaryQuery } from "./domain-summary-request";
import { safeAccountReturn } from "./account-return";
export { safeAccountReturn } from "./account-return";
import { ssrfError } from "./audit-url-validation";
import { boundedJson } from "./bounded-request";
import { adminPath, adminQuery, adminEntitlement, adminSuspension } from "./admin-request";
import { feedbackTreatment } from "./feedback-request";
import { validIntroduction } from "./report-introduction";
import { oauthCallbackError, type OAuthCallbackError } from "./oauth-callback-error";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
export const SESSION_COOKIE = "argos_account";
export const CSRF_COOKIE = "argos_account_csrf";
const CLAIM_INDEX = "argos_account_claims";
// Keep the configured origin authoritative; never infer trust from request/proxy headers.
const origin = () => (
  process.env.ACCOUNT_ORIGIN
  ?? process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.NODE_ENV === "production" ? "https://argos.lelouet.fr" : "http://localhost:3000")
).replace(/\/+$/, "");
export function accountCookieOptions(maxAge: number) { return { httpOnly: true, secure: origin().startsWith("https:"), sameSite: "lax" as const, path: "/", maxAge }; }
export function privateError(error: string, status: number) { return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } }); }
function oauthFailure(request: NextRequest, state: string | null, error: OAuthCallbackError) {
  const returnCookie = state ? request.cookies.get("argos_return_" + state)?.value : undefined;
  const destination = safeAccountReturn(returnCookie);
  const prefix = destination.startsWith("/en/") ? "/en" : "";
  const settings = request.cookies.get("argos_intent_" + state)?.value === "link" && /^\/(?:en\/)?account\/settings(?:\?section=(?:profile|security|connections))?$/.test(destination);
  const response = NextResponse.redirect(new URL(settings ? prefix + "/account/settings?section=connections&error=" + error : prefix + "/account/sign-in?error=" + error, origin()), 303);
  response.headers.set("Cache-Control", "private, no-store");
  if (returnCookie) response.cookies.set("argos_account_return", destination, accountCookieOptions(86400));
  if (state) {
    response.cookies.set("argos_oauth_" + state, "", accountCookieOptions(0));
    response.cookies.set("argos_return_" + state, "", accountCookieOptions(0));
    response.cookies.set("argos_intent_" + state, "", accountCookieOptions(0));
  }
  return response;
}
export function validCsrf(request: NextRequest): boolean {
  const cookie = request.cookies.get(CSRF_COOKIE)?.value ?? "", header = request.headers.get("x-argos-csrf") ?? "";
  return request.headers.get("origin") === origin() && /^[A-Za-z0-9_-]{43}$/.test(cookie) && cookie.length === header.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
}
export function accountHeaders(request: NextRequest, mutation: boolean): Headers | NextResponse {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (mutation && !validCsrf(request)) return privateError("csrf_invalid", 403);
  const headers = new Headers({ Accept: "application/json", "Content-Type": "application/json" });
  if (session !== undefined) {
    if (!session || session.length > 4096) return privateError("session_invalid", 401);
    headers.set("Authorization", "Bearer " + session);
  }
  if (mutation) {
    headers.set("Origin", origin());
    headers.set("X-Argos-CSRF", request.headers.get("x-argos-csrf")!);
  }
  const csrf = request.cookies.get(CSRF_COOKIE)?.value;
  if (csrf) headers.set("Cookie", CSRF_COOKIE + "=" + csrf);
  return headers;
}
type Claim = { id: string; hash: string };
function claims(request: NextRequest): Claim[] {
  try {
    const value: unknown = JSON.parse(request.cookies.get(CLAIM_INDEX)?.value ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is Claim => item && typeof item.id === "string" && /^\d{1,19}$/.test(item.id) && typeof item.hash === "string" && /^[a-f0-9]{64}$/.test(item.hash)).slice(-8) : [];
  } catch { return []; }
}
export function saveRunProof(request: NextRequest, response: NextResponse, id: string, token: string, proof: string) {
  if (!/^\d{1,19}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(proof)) return;
  const previous = claims(request).filter(item => item.id !== id);
  if (previous.length >= 8) response.cookies.set("argos_run_" + previous.shift()!.id, "", accountCookieOptions(0));
  const next = [...previous, { id, hash: createHash("sha256").update(token).digest("hex") }];
  response.cookies.set("argos_run_" + id, proof, accountCookieOptions(86400));
  response.cookies.set(CLAIM_INDEX, JSON.stringify(next), accountCookieOptions(86400));
}
export function claimContext(request: NextRequest, reportToken: unknown): string | null {
  if (typeof reportToken !== "string" || reportToken.length > 512) return null;
  const hash = createHash("sha256").update(reportToken).digest("hex");
  return claims(request).find(item => item.hash === hash && request.cookies.has("argos_run_" + item.id))?.id ?? null;
}
const allowed: Record<string, RegExp> = {
  GET: /^(?:overview|pages|analyses\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|domain-batches|domains\/\d{1,19}\/batches\/\d{1,19}\/progress(?:\/pages)?|domain-discoveries(?:\/\d{1,19}(?:\/pages)?)?|auth\/providers|me|usage(?:\/events)?|analysis-profiles|sessions|methods|urls\/\d{1,19}\/history|report-context\/[A-Za-z0-9_-]{20,512}|sites(?:\/\d{1,19}(?:\/urls)?)?|runs|runs\/\d{1,19}(?:\/report)?|auth\/oauth\/(?:google|github|linkedin)\/callback)$/,
  POST: /^(?:domain-batches|domains\/\d{1,19}\/batches\/\d{1,19}\/cancel|domain-discoveries(?:\/\d{1,19}\/cancel)?|analyses|auth\/(?:register|login|verify|resend|forgot|reset|renew|logout|reauth|confirm-email)|auth\/oauth\/(?:google|github|linkedin)\/start|sessions\/revoke-others|methods\/password|methods\/\d{1,19}\/remove|me\/archive|sites(?:\/\d{1,19}\/urls)?|runs\/\d{1,19}\/claim)$/,
  PUT: /^report-introduction\/[A-Za-z0-9_-]{20,512}$/,
  PATCH: /^me$/,
  DELETE: /^(?:sessions\/\d{1,19}|report-introduction\/[A-Za-z0-9_-]{20,512})$/,
};
export async function accountProxy(request: NextRequest, parts: string[]): Promise<NextResponse> {
  const path = parts.join("/"), mutation = request.method !== "GET", callback = /^auth\/oauth\/(google|github|linkedin)\/callback$/.test(path);
  if (!allowed[request.method]?.test(path) && !(request.method === "GET" && domainSummaryPath(path)) && !(request.method === "GET" && /^report-introduction\/[A-Za-z0-9_-]{20,512}$/.test(path)) && !adminPath(request.method,path)) return privateError("resource_unavailable", 404);
  const headers = accountHeaders(request, mutation);
  if (headers instanceof NextResponse) return headers;
  let body: string | undefined, returnTo = "/account", preserveReturn = false, linkIntent = false;
  if (mutation) {
    try {
      // DELETE has no forwarded payload; some runtimes expose an empty request stream.
      const value = request.method === "DELETE" ? {} : request.body ? await boundedJson(request) : {};
      if (value === null || typeof value !== "object" || Array.isArray(value)) return privateError("payload_invalid", 400);
      const parsed = value as Record<string, unknown>;
      if (request.method === "PUT" && path.startsWith("report-introduction/") && !validIntroduction(parsed)) return privateError("introduction_invalid",400);
      if(path.startsWith("admin/") && !(path.startsWith("admin/feedback/") ? feedbackTreatment(parsed) : path.endsWith("/suspension") ? adminSuspension(parsed) : adminEntitlement(parsed))) return privateError("payload_invalid",400);
      if (path.endsWith("/start") || path === "auth/register" || path === "auth/forgot" || path === "auth/confirm-email") {
        returnTo = safeAccountReturn(parsed.returnTo);
        linkIntent = parsed.intent === "link";
        preserveReturn = !path.endsWith("/start");
        headers.set("Accept-Language", returnTo.startsWith("/en/") ? "en" : "fr");
        // Report tokens stay in the browser's HttpOnly return cookie, never in the OAuth DB row.
        if (preserveReturn) delete parsed.returnTo;
        else parsed.returnTo = returnTo.startsWith("/en/") ? "/en/account" : "/account";
      }
      if (/^sites(?:\/\d{1,19}\/urls)?$/.test(path)) {
        if (Object.keys(parsed).some(key => key !== "url") || typeof parsed.url !== "string" || parsed.url.length > 2048 || ssrfError(parsed.url)) return privateError("url_invalid",400);
      }
      if (path === "domain-batches") {
        const id = (value: unknown) => typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= BigInt("9223372036854775807");
        if (Object.keys(parsed).some(key => !["discoveryId","selectedPageIds","profileId"].includes(key)) || !id(parsed.discoveryId) || !Array.isArray(parsed.selectedPageIds) || parsed.selectedPageIds.length < 1 || parsed.selectedPageIds.length > 50 || parsed.selectedPageIds.some(value => !id(value)) || new Set(parsed.selectedPageIds).size !== parsed.selectedPageIds.length) return privateError("selection_invalid",400);
        if (typeof parsed.profileId !== "string" || !/^[a-z0-9-]{1,64}$/.test(parsed.profileId)) return privateError("unsupported_profile",400);
        const key = request.headers.get("idempotency-key");
        if (!key || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)) return privateError("idempotency_key_invalid",400);
        headers.set("Idempotency-Key",key);
      }
      if (/^domains\/\d{1,19}\/batches\/\d{1,19}\/cancel$/.test(path) && Object.keys(parsed).length) return privateError("payload_invalid",400);
      if (path === "domain-discoveries") {
        if (Object.keys(parsed).some(key=>!["hostname","maxUrls","maxDepth","excludedPaths"].includes(key)) || typeof parsed.hostname!=="string" || !/^[A-Za-z0-9.-]{1,253}$/.test(parsed.hostname) || ssrfError("https://"+parsed.hostname)) return privateError("hostname_invalid",400);
        if (!Number.isInteger(parsed.maxUrls) || Number(parsed.maxUrls)<1 || Number(parsed.maxUrls)>50 || !Number.isInteger(parsed.maxDepth) || Number(parsed.maxDepth)<0 || Number(parsed.maxDepth)>3) return privateError("payload_invalid",400);
        if (!Array.isArray(parsed.excludedPaths) || parsed.excludedPaths.length>50 || parsed.excludedPaths.some(p=>typeof p!=="string" || p.length>2048 || !p.startsWith("/") || /[?%#\\\x00-\x20\x7f]/.test(p) || p.includes("/../") || p.endsWith("/.."))) return privateError("exclusions_invalid",400);
        const key=request.headers.get("idempotency-key");
        if(!key || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key))return privateError("idempotency_key_invalid",400);
        headers.set("Idempotency-Key",key);
      }
      if (/^domain-discoveries\/\d{1,19}\/cancel$/.test(path) && Object.keys(parsed).length) return privateError("payload_invalid",400);
      if (path === "analyses") {
        if (Object.keys(parsed).some(key => !["url", "profileId"].includes(key)) || typeof parsed.url !== "string" || parsed.url.length > 2048 || ssrfError(parsed.url)) return privateError("url_invalid", 400);
        if (typeof parsed.profileId !== "string" || !/^[a-z0-9-]{1,64}$/.test(parsed.profileId)) return privateError("unsupported_profile", 400);
        const key = request.headers.get("idempotency-key");
        if (!key || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)) return privateError("idempotency_key_invalid", 400);
        headers.set("Idempotency-Key", key);
      }
      body = request.method === "DELETE" ? undefined : JSON.stringify(parsed);
    } catch { return privateError("payload_invalid", 400); }
  }
  let state: string | null = null;
  if (callback) {
    state = request.nextUrl.searchParams.get("state");
    if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state)) return oauthFailure(request, null, "oauth_invalid");
    const browser = request.cookies.get("argos_oauth_" + state)?.value;
    if (!browser) return oauthFailure(request, state, "oauth_invalid");
    headers.set("X-Argos-OAuth-Browser", browser);
  }
  const claim = /^runs\/(\d{1,19})\/claim$/.exec(path);
  if (claim) {
    const proof = request.cookies.get("argos_run_" + claim[1])?.value;
    if (!proof) return privateError("resource_unavailable", 404);
    headers.set("X-Argos-Run-Proof", proof);
  }
  const overviewParams = ["overview","pages"].includes(path) ? overviewQuery(request.nextUrl.searchParams) : undefined;
  if (overviewParams === null) return privateError("filter_invalid",400);
  const adminParams=path.startsWith("admin/") ? adminQuery(path,request.nextUrl.searchParams) : undefined;
  if(adminParams===null) return privateError("filter_invalid",400);
  const summaryParams = request.method === "GET" && domainSummaryPath(path) ? domainSummaryQuery(path, request.nextUrl.searchParams) : undefined;
  if (summaryParams === null) return privateError("filter_invalid",400);
  const query = overviewParams ?? summaryParams ?? adminParams ?? new URLSearchParams();
  if(summaryParams === undefined && (path === "domain-batches" || /^domains\/\d{1,19}\/batches\//.test(path))) {
    const params=request.nextUrl.searchParams;
    if(request.method === "GET" && path.endsWith("/progress/pages")) {
      if([...params.keys()].some(key=>!["limit","offset","status"].includes(key)||params.getAll(key).length!==1)) return privateError("filter_invalid",400);
      const limit=params.get("limit")??"20",offset=params.get("offset")??"0",status=params.get("status")??"all";
      if(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100||!/^(0|[1-9][0-9]{0,15})$/.test(offset)||!Number.isSafeInteger(Number(offset))||!["all","QUEUED","RUNNING","COMPLETED","FAILED","CANCELED"].includes(status)) return privateError("filter_invalid",400);
      query.set("limit",limit);query.set("offset",offset);query.set("status",status);
    } else if(params.size) return privateError("payload_invalid",400);
  }
  if(path.startsWith("domain-discoveries")) {
    const params=request.nextUrl.searchParams;
    if(request.method==="GET" && /^domain-discoveries\/\d{1,19}\/pages$/.test(path)) {
      if([...params.keys()].some(key=>!["limit","offset","inclusion"].includes(key)||params.getAll(key).length!==1))return privateError("filter_invalid",400);
      const limit=params.get("limit")??"20",offset=params.get("offset")??"0",inclusion=params.get("inclusion")??"all";
      if(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100||!/^(0|[1-9][0-9]{0,15})$/.test(offset)||!Number.isSafeInteger(Number(offset))||!["all","eligible","excluded"].includes(inclusion))return privateError("filter_invalid",400);
      query.set("limit",limit);query.set("offset",offset);query.set("inclusion",inclusion);
    } else if(params.size) return privateError("payload_invalid",400);
  }
  if(path==="usage/events") {
    if([...request.nextUrl.searchParams.keys()].some(key=>!["period","limit","offset"].includes(key)) || [...request.nextUrl.searchParams.keys()].some(key=>request.nextUrl.searchParams.getAll(key).length!==1)) return privateError("payload_invalid",400);
    const period=request.nextUrl.searchParams.get("period"),limit=request.nextUrl.searchParams.get("limit")??"20",offset=request.nextUrl.searchParams.get("offset")??"0";
    if(period!==null&&!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period))return privateError("period_invalid",400);
    if(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100||!/^(0|[1-9][0-9]{0,15})$/.test(offset)||!Number.isSafeInteger(Number(offset)))return privateError("payload_invalid",400);
    if(period)query.set("period",period);query.set("limit",limit);query.set("offset",offset);
  }
  if ((["usage", "analysis-profiles"].includes(path) || path.startsWith("analyses/")) && request.nextUrl.searchParams.size) return privateError("payload_invalid",400);
  if (callback) {
    query.set("state", state!);
    const code = request.nextUrl.searchParams.get("code"); if (code) query.set("code", code);
  } else if (/^(?:sites(?:\/\d{1,19}\/urls)?|urls\/\d{1,19}\/history)$/.test(path)) {
    if ([...request.nextUrl.searchParams.keys()].some(key => !(path.startsWith("sites") ? ["limit","cursor","q"] : ["limit","cursor"]).includes(key))) return privateError("payload_invalid",400);
    const limit=request.nextUrl.searchParams.get("limit") ?? "20", cursor=request.nextUrl.searchParams.get("cursor");
    if (!/^[1-9]\d{0,2}$/.test(limit) || Number(limit)>100) return privateError("limit_invalid",400);
    if (cursor !== null && !/^[1-9]\d{0,18}$/.test(cursor)) return privateError("cursor_invalid",400);
    const term=request.nextUrl.searchParams.get("q");
    if(term!==null) {
      if(term.length>200 || /[\x00-\x1f\x7f]/.test(term)) return privateError("filter_invalid",400);
      query.set("q",term.trim());
    }
    query.set("limit",limit); if(cursor) query.set("cursor",cursor);
  } else if (path === "runs") query.set("limit", String(Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit")) || 20))));
  try {
    const upstream = await fetch((process.env.API_BASE ?? "http://api-backend:8081") + "/api/account/" + path + (query.size ? "?" + query : ""), {
      method: request.method, headers, ...(body !== undefined ? { body } : {}), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
    const data = await upstream.text();
    let response: NextResponse;
    if (callback) {
      const returnCookie = request.cookies.get("argos_return_" + state)?.value;
      let target = safeAccountReturn(returnCookie);
      if (upstream.ok && !returnCookie) { try { target = safeAccountReturn(JSON.parse(data).returnTo); } catch { target = "/account"; } }
      if (upstream.ok) response = NextResponse.redirect(new URL(target, origin()), 303);
      else {
        let error: OAuthCallbackError = upstream.status >= 500 ? "account_unavailable" : "oauth_invalid";
        try { error = oauthCallbackError(JSON.parse(data)?.error, error); } catch { /* Never expose upstream text. */ }
        if (error === "oauth_invalid" && upstream.status === 400 && request.nextUrl.searchParams.get("error") === "access_denied") error = "oauth_cancelled";
        response = oauthFailure(request, state, error);
      }
      if (upstream.ok) response.cookies.set("argos_account_return", safeAccountReturn(target), accountCookieOptions(86400));
      response.cookies.set("argos_oauth_" + state, "", accountCookieOptions(0));
      response.cookies.set("argos_return_" + state, "", accountCookieOptions(0));
    response.cookies.set("argos_intent_" + state, "", accountCookieOptions(0));
    } else if (path === "auth/login" && upstream.status === 401) {
      // This endpoint authenticates supplied credentials, not the existing cookie.
      response = privateError("credentials_invalid", 401);
    } else response = new NextResponse(data, { status: upstream.status, headers: { "Content-Type": "application/json" } });
    response.headers.set("Cache-Control", "private, no-store");
    if (upstream.ok && preserveReturn) response.cookies.set("argos_account_return", returnTo, accountCookieOptions(86400));
    const jwt = upstream.headers.get("x-argos-session");
    if (upstream.ok && jwt) response.cookies.set(SESSION_COOKIE, jwt, accountCookieOptions(900));
    if (upstream.status === 401 && path !== "auth/login" || upstream.ok && (path === "auth/logout" || path === "auth/reset" || path === "me/archive"))
      response.cookies.set(SESSION_COOKIE, "", accountCookieOptions(0));
    if (upstream.status === 429) response.headers.set("Retry-After", upstream.headers.get("retry-after") ?? "900");
    if (upstream.ok && path.endsWith("/start")) {
      const start = JSON.parse(data), browser = upstream.headers.get("x-argos-oauth-browser");
      if (typeof start.state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(start.state) || !browser) return privateError("oauth_invalid", 503);
      response.cookies.set("argos_oauth_" + start.state, browser, accountCookieOptions(600));
      response.cookies.set("argos_return_" + start.state, returnTo, accountCookieOptions(600));
      response.cookies.set("argos_intent_" + start.state, linkIntent ? "link" : "login", accountCookieOptions(600));
    }
    return response;
  } catch { return callback ? oauthFailure(request, state, "account_unavailable") : privateError("account_unavailable", 503); }
}
