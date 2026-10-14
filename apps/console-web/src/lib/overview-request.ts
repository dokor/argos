/** Shared dashboard/BFF query allowlist: never accept an owner from the browser. */
export function overviewQuery(params: URLSearchParams): URLSearchParams | null {
  const keys = ["attention", "query", "domainId", "limit", "offset"];
  if (
    [...params.keys()].some(
      (k) => !keys.includes(k) || params.getAll(k).length !== 1,
    )
  )
    return null;
  const limit = params.get("limit") ?? "20",
    offset = params.get("offset") ?? "0",
    attention = params.get("attention"),
    domain = params.get("domainId"),
    query = params.get("query");
  if (
    !/^[1-9][0-9]{0,2}$/.test(limit) ||
    Number(limit) > 100 ||
    !/^(0|[1-9][0-9]{0,15})$/.test(offset) ||
    !Number.isSafeInteger(Number(offset))
  )
    return null;
  if (
    attention !== null &&
    !["priority", "incomplete", "active"].includes(attention)
  )
    return null;
  if (
    domain !== null &&
    (!/^[1-9][0-9]{0,18}$/.test(domain) ||
      BigInt(domain) > BigInt("9223372036854775807"))
  )
    return null;
  if (
    query !== null &&
    (query.length > 2048 || /[\x00-\x1f\x7f-\x9f]/.test(query))
  )
    return null;
  const result = new URLSearchParams(params);
  result.set("limit", limit);
  result.set("offset", offset);
  return result;
}
export function safeOverviewReturn(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > 4096 ||
    /[\\#\x00-\x20]/.test(raw) ||
    raw.split("?").length > 2
  )
    return null;
  const [path, query] = raw.split("?");
  return /^\/(?:en\/)?account$/.test(path) &&
    overviewQuery(new URLSearchParams(query))
    ? raw
    : null;
}
