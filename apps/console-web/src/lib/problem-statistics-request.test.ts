import { expect, it } from "vitest";
import { adminPath, adminQuery } from "./admin-request";

it("allows only the read endpoint and its bounded aggregation filters", () => {
  expect(adminPath("GET", "admin/problem-statistics")).toBe(true);
  expect(adminPath("POST", "admin/problem-statistics")).toBe(false);
  expect(adminPath("GET", "admin/problem-statistics/export")).toBe(false);
  expect(adminQuery("admin/problem-statistics", new URLSearchParams("days=90&category=security"))?.toString()).toBe("days=90&category=security");
  for (const query of ["days=7", "days=365", "days=30&days=90", "category=http", "category=", "url=private", "token=private", "user=1", "limit=1000"]) {
    expect(adminQuery("admin/problem-statistics", new URLSearchParams(query)), query).toBeNull();
  }
});
