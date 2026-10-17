import type { AdminReason } from "./connected/contracts";
export const adminReasons: AdminReason[] = [
  "SUPPORT_REQUEST",
  "PLAN_ADJUSTMENT",
  "ABUSE_REVIEW",
  "ACCOUNT_RECOVERY",
];
const id = (value: string) =>
  /^[1-9][0-9]{0,18}$/.test(value) &&
  BigInt(value) <= BigInt("9223372036854775807");
export function adminPath(method: string, path: string): boolean {
  const ids = path.match(/\/([0-9]+)(?:\/|$)/g);
  if (ids?.some((v) => !id(v.replaceAll("/", "")))) return false;
  return method === "GET"
    ? /^admin\/(?:feedback(?:\/[1-9]\d{0,18})?|users(?:\/[1-9]\d{0,18}(?:\/events)?)?|runs(?:\/[1-9]\d{0,18}(?:\/report)?)?|statistics|queue|run-options|events|analytics(?:\/settings)?|traffic|entitlement-options)$/.test(
        path,
      )
    : method === "PATCH"
      ? /^admin\/(?:analytics\/settings|feedback\/[1-9]\d{0,18}|users\/[1-9]\d{0,18}\/entitlement)$/.test(
          path,
        )
      : method === "POST" &&
        /^admin\/users\/[1-9]\d{0,18}\/suspension$/.test(path);
}
export function adminQuery(
  path: string,
  params: URLSearchParams,
): URLSearchParams | null {
  const keys =
    path === "admin/statistics" ? ["period"] : path === "admin/run-options"
      ? ["kind", "q", "limit", "cursor"]
      : ["admin/analytics","admin/traffic"].includes(path)
      ? path === "admin/traffic" ? ["days","group"] : ["days"]
      : path === "admin/feedback"
        ? ["type", "status", "limit", "cursor"]
        : path === "admin/users"
          ? ["q", "state", "offer", "limit", "cursor"]
          : path === "admin/runs"
            ? ["user", "site", "status", "from", "until", "limit", "cursor"]
            : path === "admin/events"
              ? ["limit", "cursor", "target"]
              : /^admin\/users\/\d+\/events$/.test(path)
                ? ["limit", "cursor"]
                : [];
  for (const [key, value] of params) {
    if (
      !keys.includes(key) ||
      params.getAll(key).length !== 1 ||
      value.length > 253 ||
      /[\x00-\x1f\x7f-\x9f]/.test(value)
    )
      return null;
    if (path === "admin/run-options" && ((key === "kind" && !["site", "user"].includes(value)) || (key === "q" && value.length > 100))) return null;
    if (key === "period" && !["all", "7", "30", "90"].includes(value)) return null;
    if(key === "group" && !["day","week","month"].includes(value)) return null;
    if (key === "days" && !["7", "30", "90"].includes(value)) return null;
    if (
      key === "limit" &&
      (!/^[1-9]\d{0,2}$/.test(value) || Number(value) > 100)
    )
      return null;
    if (["cursor", "target"].includes(key) && !id(value)) return null;
    if (
      path === "admin/users" &&
      ((key === "q" && value.length > 100) ||
        (key === "state" &&
          !["ACTIVE", "PENDING", "SUSPENDED", "ARCHIVED"].includes(value)) ||
        (key === "offer" && !/^[A-Z][A-Z0-9_]{0,15}$/.test(value)))
    )
      return null;
  }
  return new URLSearchParams(params);
}
function common(body: Record<string, unknown>): boolean {
  return (
    body.confirmation === true &&
    typeof body.expectedVersion === "number" &&
    Number.isSafeInteger(body.expectedVersion) &&
    body.expectedVersion >= 0 &&
    adminReasons.includes(body.reasonCode as AdminReason)
  );
}
export function adminEntitlement(body: Record<string, unknown>): boolean {
  return (
    Object.keys(body).sort().join(",") ===
      "confirmation,expectedVersion,monthlyLimit,offer,reasonCode" &&
    common(body) &&
    typeof body.offer === "string" &&
    /^[A-Z][A-Z0-9_]{0,15}$/.test(body.offer) &&
    (body.monthlyLimit === null ||
      (typeof body.monthlyLimit === "number" &&
        Number.isSafeInteger(body.monthlyLimit) &&
        body.monthlyLimit >= 0))
  );
}
export function adminSuspension(body: Record<string, unknown>): boolean {
  return (
    Object.keys(body).sort().join(",") ===
      "confirmation,expectedVersion,reasonCode,suspended" &&
    common(body) &&
    typeof body.suspended === "boolean"
  );
}
export function safeAdminReturn(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > 2048 ||
    /[\\#\x00-\x20]/.test(raw) ||
    raw.split("?").length > 2
  )
    return null;
  const [path, query] = raw.split("?");
  return /^\/(?:en\/)?account\/admin\/users$/.test(path) &&
    adminQuery("admin/users", new URLSearchParams(query))
    ? raw
    : null;
}

/** Only the analysis list and its validated filters can be a run-detail return target. */
export function safeAdminRunReturn(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048 || /[\\#\x00-\x20]/.test(raw) || raw.split("?").length > 2) return null;
  const [path, query] = raw.split("?");
  return /^\/(?:en\/)?account\/admin\/runs$/.test(path) && adminQuery("admin/runs", new URLSearchParams(query)) ? raw : null;
}

export function adminMeasurement(body: Record<string, unknown>): boolean {
  return Object.keys(body).sort().join(",") === "confirmation,enabled,expectedVersion" && body.confirmation === true && typeof body.enabled === "boolean" && typeof body.expectedVersion === "number" && Number.isSafeInteger(body.expectedVersion) && body.expectedVersion >= 0 && body.expectedVersion < Number.MAX_SAFE_INTEGER;
}
