// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SessionRenewal from "./SessionRenewal";
import { renewAccountSession } from "@/lib/account-client";

vi.mock("@/lib/account-client", () => ({ renewAccountSession: vi.fn() }));
beforeEach(() => { vi.useFakeTimers(); vi.mocked(renewAccountSession).mockReset().mockResolvedValue(true); });
afterEach(() => vi.useRealTimers());

it("renews on public pages, on return to the tab, and stops on unmount", async () => {
  const view = render(<SessionRenewal enabled />);
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
  render(<SessionRenewal enabled />);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(renewAccountSession).toHaveBeenCalledTimes(2);
});

it("does not renew an anonymous visit on mount, focus, online or the periodic timer", async () => {
  render(<SessionRenewal />);
  await act(async () => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(1200000); });
  expect(renewAccountSession).not.toHaveBeenCalled();
});

it("starts after login and stops after invalidation, even when initially anonymous", async () => {
  render(<SessionRenewal />);
  await act(async () => { window.dispatchEvent(new Event("argos-account-login")); });
  expect(renewAccountSession).toHaveBeenCalledOnce();
  await act(async () => { window.dispatchEvent(new Event("argos-account-invalid")); await vi.advanceTimersByTimeAsync(600000); window.dispatchEvent(new Event("focus")); });
  expect(renewAccountSession).toHaveBeenCalledOnce();
  await act(async () => { window.dispatchEvent(new Event("argos-account-login")); });
  expect(renewAccountSession).toHaveBeenCalledTimes(2);
});
