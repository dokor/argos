import type { CreateBatch, CreateDiscovery } from "./contracts";
import { validDomainId } from "./domain-navigation";
export type DomainRequest =
  | { key: string; kind: "discovery"; body: CreateDiscovery }
  | { key: string; kind: "batch"; body: CreateBatch };
/** Durable intent only. Replaying always requires an explicit click and server authorization. */
export function readDomainRequest(raw: string | null): DomainRequest | null {
  if (!raw || raw.length > 60000) return null;
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      typeof value.key !== "string" ||
      !/^[-a-f0-9]{36}$/.test(value.key)
    )
      return null;
    const b = value.body;
    if (!b || typeof b !== "object") return null;
    if (
      value.kind === "discovery" &&
      typeof b.hostname === "string" &&
      b.hostname.length <= 253 &&
      Number.isInteger(b.maxUrls) &&
      b.maxUrls >= 1 &&
      b.maxUrls <= 50 &&
      Number.isInteger(b.maxDepth) &&
      b.maxDepth >= 0 &&
      b.maxDepth <= 3 &&
      Array.isArray(b.excludedPaths) &&
      b.excludedPaths.length <= 50 &&
      b.excludedPaths.every(
        (p: unknown) =>
          typeof p === "string" && p.startsWith("/") && p.length <= 2048,
      )
    )
      return {
        key: value.key,
        kind: value.kind,
        body: {
          hostname: b.hostname,
          maxUrls: b.maxUrls,
          maxDepth: b.maxDepth,
          excludedPaths: b.excludedPaths,
        },
      };
    if (
      value.kind === "batch" &&
      typeof b.discoveryId === "string" &&
      validDomainId(b.discoveryId) &&
      typeof b.profileId === "string" &&
      b.profileId.length <= 100 &&
      Array.isArray(b.selectedPageIds) &&
      b.selectedPageIds.length > 0 &&
      b.selectedPageIds.length <= 50 &&
      new Set(b.selectedPageIds).size === b.selectedPageIds.length &&
      b.selectedPageIds.every(
        (id: unknown) => typeof id === "string" && validDomainId(id),
      )
    )
      return {
        key: value.key,
        kind: value.kind,
        body: {
          discoveryId: b.discoveryId,
          profileId: b.profileId,
          selectedPageIds: b.selectedPageIds,
        },
      };
  } catch {}
  return null;
}
