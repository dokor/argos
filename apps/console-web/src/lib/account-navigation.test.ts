import { expect, it } from "vitest";
import { authLanguagePath, localizedAccountReturn } from "./account-navigation";
import { safeAccountReturn } from "./account-return";

it.each([
  "/account/sites/42", "/account/settings?section=connections",
  "/report/" + "r".repeat(43), "/account?attention=priority&domainId=7&query=example.com&offset=20",
  "/account/domains/7/batches/9?tab=pages&severity=CRITICAL&historyOffset=20",
  "/account/runs/42?returnTo=" + encodeURIComponent("/account/domains/7/batches/9?tab=pages&severity=CRITICAL"),
  "/account/admin/users/7?returnTo=" + encodeURIComponent("/account/admin/users?q=fixture&cursor=20"),
])("localizes an allowed resource and its context FR→EN→FR: %s", path => {
  expect(safeAccountReturn(path)).toBe(path);
  const en = localizedAccountReturn(path,"en");
  expect(en).toMatch(/^\/en\//);
  expect(safeAccountReturn(en)).toBe(en);
  expect(localizedAccountReturn(en,"fr")).toBe(path);
  if (path.includes("returnTo=")) expect(new URL(en,"https://fixture.invalid").searchParams.get("returnTo")).toMatch(/^\/en\//);
});
it.each([undefined,null,"https://evil.example","//evil.example","/\\evil","/account/sites/7?owner=9","/account?returnTo=https://evil.example","/account/settings#secret","/api/audits","/account/runs/7?returnTo=%2F%2Fevil.example"])("rejects unsafe or absent return context %s", raw => {
  expect(localizedAccountReturn(raw,"en")).toBe("/en/account/sites");
  expect(localizedAccountReturn(raw,"fr")).toBe("/account/sites");
});
it("keeps a live verification token fragment-only while localizing return context", () => {
  const path = authLanguagePath("/en/account/verify?error=oauth_cancelled", "fr", {returnTo:"/en/account/settings?section=profile",token:"synthetic-token"});
  const url = new URL(path,"https://fixture.invalid");
  expect(url.pathname).toBe("/account/verify");
  expect(url.searchParams.get("returnTo")).toBe("/account/settings?section=profile");
  expect(url.searchParams.get("error")).toBe("oauth_cancelled");
  expect(url.search).not.toContain("synthetic-token");
  expect(url.hash).toBe("#token=synthetic-token");
  expect(authLanguagePath(path,"en",{returnTo:"/account/sites",token:""})).not.toContain("#");
});
it("does not replace an unresolved cookie destination with a guessed default", () => {
  expect(authLanguagePath("/account/verify", "en", {token:"fixture"})).toBe("/en/account/verify#token=fixture");
});
