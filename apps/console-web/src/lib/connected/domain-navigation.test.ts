import { describe, it, expect } from "vitest";
import {
  domainFilters,
  safeDomainReturn,
  validDomainId,
} from "./domain-navigation";
import { readDomainRequest } from "./domain-request";
import { safeAccountReturn } from "../account-return";
import { localizedPath } from "../i18n/routes";
describe("domain navigation", () => {
  it("keeps BIGINT identity, selected rule/version and page across language and return links", () => {
    const path =
      "/account/domains/9007199254740993/batches/9007199254740995?tab=pages&rule=http.hsts&definitionVersion=" +
      "a".repeat(64) +
      "&offset=20";
    expect(safeDomainReturn(path)).toBe(path);
    expect(safeAccountReturn(path)).toBe(path);
    expect(localizedPath(path, "en")).toBe("/en" + path);
    expect(localizedPath("/en" + path, "fr")).toBe(path);
    expect(
      domainFilters(new URLSearchParams(path.split("?")[1]))?.query.get(
        "ruleKey",
      ),
    ).toBe("http.hsts");
  });
  it.each([
    "//evil.test",
    "https://evil.test",
    "/account/domains/1/batches/2?tab=pages&offset=-1",
    "/account/domains/1/batches/2?tab=pages&tab=summary",
    "/account/domains/1/batches/2?rule=x&ruleKey=y",
    "/account/domains/1/batches/2?definitionVersion=" + "a".repeat(64),
    "/account/domains/9223372036854775808/batches/2",
    "/account/domains/1/batches/2?next=https://evil.test",
  ])("rejects ambiguous/unsafe return %s", (path) =>
    expect(safeDomainReturn(path)).toBeNull(),
  );
  it("validates domain list filters before sign-in return", () => {
    expect(
      safeAccountReturn("/en/account/domains?query=atelier&offset=20"),
    ).toBe("/en/account/domains?query=atelier&offset=20");
    expect(safeAccountReturn("/account/domains?next=//evil.test")).toBe(
      "/account/sites",
    );
    expect(validDomainId("0")).toBe(false);
  });
  it("recovers only bounded requests and exact identifiers", () => {
    const value = {
      key: "a1234567-1234-1234-1234-123456789012",
      kind: "batch",
      body: {
        discoveryId: "9007199254740993",
        profileId: "server-default-v1",
        selectedPageIds: ["9007199254740995"],
      },
    };
    expect(readDomainRequest(JSON.stringify(value))).toEqual(value);
    expect(
      readDomainRequest(
        JSON.stringify({
          ...value,
          body: { ...value.body, selectedPageIds: ["1", "1"] },
        }),
      ),
    ).toBeNull();
    expect(readDomainRequest("not json")).toBeNull();
  });
});
