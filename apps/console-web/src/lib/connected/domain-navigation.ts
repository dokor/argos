import { domainSummaryQuery } from "../domain-summary-request";
export const validDomainId = (id: string) =>
  /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= BigInt("9223372036854775807");
export const batchPath = (domain: string, batch: string) =>
  `/account/domains/${domain}/batches/${batch}`;
export function domainFilters(params: URLSearchParams) {
  const query = new URLSearchParams(params);
  const tab = query.get("tab") ?? "summary",
    history = query.get("historyOffset") ?? "0";
  if (
    query.getAll("tab").length > 1 ||
    query.getAll("historyOffset").length > 1 ||
    !["summary", "pages"].includes(tab) ||
    !/^(0|[1-9][0-9]{0,15})$/.test(history) ||
    !Number.isSafeInteger(Number(history))
  )
    return null;
  query.delete("tab");
  query.delete("historyOffset");
  if (query.has("rule")) {
    if (query.has("ruleKey") || query.getAll("rule").length > 1) return null;
    query.set("ruleKey", query.get("rule")!);
    query.delete("rule");
  }
  const checked = domainSummaryQuery("domains/1/batches/1/pages", query);
  return checked
    ? { tab, historyOffset: Number(history), query: checked }
    : null;
}
/** A return link is navigation only, never an authorization capability. */
export function safeDomainReturn(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > 4096 ||
    /[\\#\x00-\x20]/.test(raw)
  )
    return null;
  const [path, query] = raw.split("?");
  if (raw.split("?").length > 2) return null;
  const match =
    /^\/(?:en\/)?account\/domains\/([1-9][0-9]{0,18})\/batches\/([1-9][0-9]{0,18})$/.exec(
      path,
    );
  return match &&
    validDomainId(match[1]) &&
    validDomainId(match[2]) &&
    domainFilters(new URLSearchParams(query))
    ? raw
    : null;
}
export function phrase(text: string, values: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}
