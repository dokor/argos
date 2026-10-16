import { accountFetch, AccountClientError } from "@/lib/account-client";
import type { DiscoveredPages } from "./contracts";

/** Fetch the entire bounded snapshot; never silently select from only its first 100 URLs. */
export async function allDiscoveryPages(path: string, _method?: string, _body?: unknown, signal?: AbortSignal): Promise<DiscoveredPages> {
  const first = await accountFetch<DiscoveredPages>(path, "GET", undefined, signal);
  if (first.total > 1000) throw new AccountClientError("payload_invalid", 502);
  const items = [...first.items];
  for (let offset = 100; offset < first.total; offset += 100) {
    const query = new URLSearchParams(path.split("?")[1]);
    query.set("offset", String(offset));
    const next = await accountFetch<DiscoveredPages>(path.split("?")[0] + "?" + query, "GET", undefined, signal);
    items.push(...next.items);
  }
  return { ...first, items };
}
