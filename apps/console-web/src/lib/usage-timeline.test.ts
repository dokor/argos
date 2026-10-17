import { expect, it } from "vitest";
import { timelinePreset, usageTimelineQuery } from "./usage-timeline";

it("builds calendar presets across leap days and year boundaries", () => {
  expect(timelinePreset("DAY", 30, "2024-03-01")).toEqual({ from: "2024-02-01", until: "2024-03-02" });
  expect(timelinePreset("MONTH", 12, "2026-01-31")).toEqual({ from: "2025-02-01", until: "2026-02-01" });
  expect(timelinePreset("YEAR", 5, "2026-12-31")).toEqual({ from: "2022-01-01", until: "2027-01-01" });
});
it.each([
  "from=2026-02-30&until=2026-03-02", "from=2025-01-01&until=2027-01-01", "from=2026-01-01&until=2026-02-01&ownerId=2",
  "from=2026-01-01&until=2026-02-01&dimension=URL&filter=1&filter=1", "from=2026-01-01&until=2026-02-01&filter=1",
  "from=2026-01-01&until=2026-02-01&dimension=URL&filter=9223372036854775808", "from=2026-01-01&until=2026-02-01&granularity=MONTH&granularity=DAY",
  "from=2026-01-02&until=2026-03-01&granularity=MONTH", "from=2026-02-01&until=2027-01-01&granularity=YEAR"
])("rejects invalid private aggregation parameters: %s", query => expect(usageTimelineQuery(new URLSearchParams(query))).toBeNull());
it("preserves exact large identifiers and multi-selection without accepting an owner", () => {
  const query = new URLSearchParams("from=2026-01-01&until=2026-02-01&dimension=URL&filter=9007199254740993&filter=unknown&q=example");
  expect(usageTimelineQuery(query)?.toString()).toBe(query.toString());
});
