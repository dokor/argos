export function adminPath(method: string, path: string): boolean {
  return method === "GET" ? /^admin\/(?:feedback(?:\/[1-9]\d{0,18})?|users(?:\/[1-9]\d{0,18})?|runs(?:\/[1-9]\d{0,18}(?:\/report)?)?|queue|events)$/.test(path)
    : method === "PATCH" && /^admin\/(?:feedback\/[1-9]\d{0,18}|users\/[1-9]\d{0,18}\/entitlement)$/.test(path);
}
export function adminQuery(path: string, params: URLSearchParams): URLSearchParams | null {
  const keys = path === "admin/feedback" ? ["type","status","limit","cursor"] : path === "admin/users" ? ["q","state","offer","limit","cursor"] : path === "admin/runs" ? ["user","site","status","from","until","limit","cursor"] : path === "admin/events" ? ["limit","cursor"] : [];
  const result = new URLSearchParams();
  for (const [key,value] of params) {
    if (!keys.includes(key) || params.getAll(key).length !== 1 || value.length > 253) return null;
    if (key === "limit" && (!/^[1-9]\d{0,2}$/.test(value) || Number(value)>100)) return null;
    if (key === "cursor" && !/^[1-9]\d{0,18}$/.test(value)) return null;
    result.set(key,value);
  }
  return result;
}
export function adminEntitlement(body: Record<string, unknown>): boolean {
  return Object.keys(body).sort().join(",") === "confirmed,monthlyLimit,offer" && body.confirmed === true
    && typeof body.offer === "string" && /^[A-Z][A-Z0-9_]{0,15}$/.test(body.offer)
    && (body.monthlyLimit === null || typeof body.monthlyLimit === "number" && Number.isSafeInteger(body.monthlyLimit) && body.monthlyLimit >= 0);
}
