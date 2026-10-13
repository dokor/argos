import { describe, it, expect } from "vitest";
import { connectedError } from "./errors";
import type { PageResult, TrackedPage, Usage } from "./contracts";

describe("connected contract boundaries", () => {
  it("keeps long IDs as strings and missing measurement separate from zero", () => {
    const failed: PageResult = { pageId: "9007199254740993", runId: "9007199254740995", normalizedUrl: "https://example.com/",
      executionStatus: "FAILED", completeness: "NONE", score: { value: null, provisional: false, reason: "TIMEOUT" },
      coverage: { ratio: null, version: null }, criticalCount: null, importantCount: null, moduleStatuses: {}, failureReason: "TIMEOUT", reportAvailable: false };
    const page: TrackedPage = { pageId: failed.pageId, domainId: "123", normalizedUrl: failed.normalizedUrl,
      latestAttempt: { runId: failed.runId, executionStatus: "FAILED", createdAt: "2026-10-13T08:00:00Z", finishedAt: "2026-10-13T08:00:30Z" },
      latestAvailableReport: null, result: failed };
    expect(JSON.parse(JSON.stringify(page)).result.score.value).toBeNull();
    expect(JSON.parse(JSON.stringify(page)).pageId).toBe("9007199254740993");
  });
  it("represents unlimited quota explicitly, without Infinity", () => {
    const usage: Usage = { offer: "FREE", period: "2026-10", timezone: "UTC", startsAt: "2026-10-01T00:00:00Z",
      resetsAt: "2026-11-01T00:00:00Z", used: 32, reserved: 0, limit: null, available: null, canLaunch: true };
    expect(JSON.parse(JSON.stringify(usage))).toEqual(usage);
  });
  it("normalizes legacy and nested errors at a single boundary", () => {
    expect(connectedError({ error: "quota_exceeded" }, 429).code).toBe("QUOTA_EXCEEDED");
    expect(connectedError({ error: { code: "QUOTA_EXCEEDED", requestId: "request-1", details: { required: 8, available: 3, currentVersion: null } } }, 409))
      .toEqual({ code: "QUOTA_EXCEEDED", requestId: "request-1", details: { required: 8, available: 3, currentVersion: null } });
    expect(connectedError({ error: { code: "internal exception text", requestId: "unsafe\nvalue", details: { required: -1, available: Number.MAX_SAFE_INTEGER + 1 } } }, 503))
      .toEqual({ code: "SERVICE_UNAVAILABLE", requestId: null, details: { required: null, available: null, currentVersion: null } });
    expect(connectedError(null, 401).code).toBe("SESSION_INVALID");
    expect(connectedError({ error: { code: null } }, 404).code).toBe("RESOURCE_UNAVAILABLE");
  });
});
