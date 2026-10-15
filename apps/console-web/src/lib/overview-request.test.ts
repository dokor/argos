import { describe, it, expect } from "vitest";
import { overviewQuery, safeOverviewReturn } from "./overview-request";
import { safeAccountReturn } from "./account-return";
describe("overview query boundary", () => {
  it.each([
    "ownerId=10",
    "attention=healthy",
    "offset=-1",
    "limit=101",
    "limit=1&limit=2",
    "query=%00",
    "domainId=9223372036854775808",
    "offset=9007199254740992",
  ])("rejects %s", (query) =>
    expect(overviewQuery(new URLSearchParams(query))).toBeNull(),
  );
  it("keeps opaque IDs, filters and offset", () =>
    expect(
      overviewQuery(
        new URLSearchParams(
          "attention=incomplete&domainId=9007199254740993&offset=20",
        ),
      )?.get("domainId"),
    ).toBe("9007199254740993"));
  it("allows safe dashboard returns through exact private reports", () => {
    const target = "/en/account?attention=priority&query=a%26b&offset=20";
    expect(safeOverviewReturn(target)).toBe(target);
    expect(safeAccountReturn(target)).toBe(target);
    const run =
      "/en/account/runs/9007199254740993?returnTo=" +
      encodeURIComponent(target);
    expect(safeAccountReturn(run)).toBe(run);
  });
  it.each([
    "//evil.example",
    "/account?returnTo=https://evil.example",
    "/account?attention=priority#x",
    "/account/sites",
    "/account?ownerId=20",
  ])("rejects unsafe return %s", (v) =>
    expect(safeOverviewReturn(v)).toBeNull(),
  );
});
