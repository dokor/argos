/** F08 private read routes and bounded, unambiguous filters. */
export function domainSummaryPath(path: string): boolean {
  return /^domains(?:\/[1-9][0-9]{0,18}\/batches(?:\/[1-9][0-9]{0,18}(?:\/pages)?)?)?$/.test(path)
    && path.split("/").filter(part => /^[0-9]+$/.test(part)).every(id => BigInt(id) <= BigInt("9223372036854775807"));
}
export function domainSummaryQuery(path: string, params: URLSearchParams): URLSearchParams | null {
  const pages = path.endsWith("/pages"), list = pages || path === "domains" || path.endsWith("/batches");
  const keys = list ? ["limit", "offset", ...(pages ? ["ruleKey", "definitionVersion", "severity", "status", "query", "sort", "scope", "completeness"] : path === "domains" ? ["query"] : [])] : [];
  if ([...params.keys()].some(key => !keys.includes(key) || params.getAll(key).length !== 1)) return null;
  const query = new URLSearchParams(params);
  if (list) {
    const limit = params.get("limit") ?? "20", offset = params.get("offset") ?? "0";
    if (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 100 || !/^(0|[1-9][0-9]{0,15})$/.test(offset) || !Number.isSafeInteger(Number(offset))) return null;
    query.set("limit", limit); query.set("offset", offset);
  }
  if (path === "domains" && params.has("query") && (params.get("query")!.length > 253 || /[\x00-\x1f\x7f-\x9f]/.test(params.get("query")!))) return null;
  if (pages) {
    const enums: Record<string, string[]> = {severity: ["CRITICAL", "IMPORTANT", "INFO"], status: ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"], completeness: ["FULL", "PARTIAL", "NONE", "UNKNOWN"], sort: ["priority", "url"], scope: ["all", "problematic", "incomplete"]};
    for (const [key, values] of Object.entries(enums)) if (params.has(key) && !values.includes(params.get(key)!)) return null;
    const rule = params.get("ruleKey"), text = params.get("query"), definition = params.get("definitionVersion");
    if (rule !== null && (!rule.trim() || rule.length > 200 || /[\x00-\x1f\x7f-\x9f]/.test(rule))) return null;
    if (text !== null && (text.length > 2048 || /[\x00-\x1f\x7f-\x9f]/.test(text))) return null;
    if (definition !== null && (!rule || !/^[a-f0-9]{64}$/.test(definition))) return null;
  }
  return query;
}
