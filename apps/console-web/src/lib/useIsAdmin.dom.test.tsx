// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useIsAdmin } from "./useIsAdmin";

const { session } = vi.hoisted(() => ({ session: { ready: true, denied: false, profile: null as null | { verified: boolean; admin: boolean } } }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => session }));
const fetchMock = vi.fn();
beforeEach(() => {
  session.ready = true; session.denied = false; session.profile = null;
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

it.each([null, { verified: true, admin: false }, { verified: false, admin: true }])("does not show admin details for profile %j without legacy access", async profile => {
  session.profile = profile;
  fetchMock.mockResolvedValue(new Response('{"isAdmin":false}'));
  const { result } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(result.current).toBe(false));
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/status", expect.objectContaining({ cache: "no-store" }));
});

it("removes the account admin affordance when the account session is denied or its role changes", async () => {
  session.profile = { verified: true, admin: true };
  fetchMock.mockResolvedValue(new Response('{"isAdmin":false}'));
  const { result, rerender } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  expect(result.current).toBe(true);
  session.denied = true; rerender();
  await waitFor(() => expect(result.current).toBe(false));
  session.denied = false; session.profile.admin = false; rerender();
  expect(result.current).toBe(false);
});

it("retains the operator affordance without any account context", async () => {
  session.ready = false;
  fetchMock.mockResolvedValue(new Response('{"isAdmin":true}'));
  const { result } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(result.current).toBe(true));
});

it("fails closed on a legacy status failure and aborts on unmount", async () => {
  fetchMock.mockRejectedValue(new Error("unavailable"));
  const { result, unmount } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(result.current).toBe(false));
  const signal = fetchMock.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});
