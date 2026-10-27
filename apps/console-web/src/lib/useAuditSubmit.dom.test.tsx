// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, renderHook } from "@/test/render";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/ArgosApi", () => ({ argosApi: { createAudit: vi.fn(), getReportStatus: vi.fn() } }));
import { argosApi } from "./ArgosApi";
import { createLogger } from "./logger";
import { useAuditSubmit } from "./useAuditSubmit";
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it("preserves the captcha proof and selected scope in the same submission", async () => {
  const scope = { kind: "check", target: "html.title" } as const;
  vi.mocked(argosApi.createAudit).mockResolvedValue({ runId: 1, auditId: 2, status: "QUEUED", reportToken: "synthetic-scoped-token" });
  const { result, unmount } = renderHook(() => useAuditSubmit({ logger: createLogger("report") }));
  await act(async () => { await result.current.submit("https://example.com", "synthetic-captcha-proof", scope); });
  expect(argosApi.createAudit).toHaveBeenCalledWith({ url: "https://example.com", sourceRoute: "/", lang: "fr", scope }, "synthetic-captcha-proof");
  expect(push).toHaveBeenCalledWith("/report/synthetic-scoped-token");
  unmount();
});
it("polls with the creation token and redirects when sanitized status completes", async () => {
  vi.useFakeTimers();
  vi.mocked(argosApi.createAudit).mockResolvedValue({ runId: 1, auditId: 2, status: "QUEUED", reportToken: "synthetic-created-token" });
  vi.mocked(argosApi.getReportStatus).mockResolvedValue({ status: "COMPLETED" });
  const logger = createLogger("landing");
  const { result, unmount } = renderHook(() => useAuditSubmit({ logger, maxWaitMs: 10000, pollIntervalMs: 100 }));
  await act(async () => { await result.current.submit("https://example.com"); });
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(argosApi.getReportStatus).toHaveBeenCalledWith("synthetic-created-token");
  expect(push).toHaveBeenCalledWith("/report/synthetic-created-token");
  unmount();
});
