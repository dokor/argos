// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SessionRenewal from "./SessionRenewal";
import { renewAccountSession } from "@/lib/account-client";

vi.mock("@/lib/account-client", () => ({ renewAccountSession: vi.fn() }));
beforeEach(() => { vi.useFakeTimers(); vi.mocked(renewAccountSession).mockReset().mockResolvedValue(true); });
afterEach(() => vi.useRealTimers());

it("renews on public pages, on return to the tab, and stops on unmount", async () => {
  const view = render(<SessionRenewal />);
  await act(async () => {});
  expect(renewAccountSession).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(600000); });
  expect(renewAccountSession).toHaveBeenCalledTimes(2);
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(renewAccountSession).toHaveBeenCalledTimes(3);
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(renewAccountSession).toHaveBeenCalledTimes(4);
  view.unmount();
  await vi.advanceTimersByTimeAsync(600000);
  window.dispatchEvent(new Event("focus"));
  expect(renewAccountSession).toHaveBeenCalledTimes(4);
});

it("retries transient errors without waiting another ten minutes", async () => {
  vi.mocked(renewAccountSession).mockRejectedValueOnce(new Error("offline"));
  render(<SessionRenewal />);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(renewAccountSession).toHaveBeenCalledTimes(2);
});
