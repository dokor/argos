// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useIsAdmin } from "./useIsAdmin";
const { session } = vi.hoisted(() => ({ session: { ready: true, denied: false, profile: null as null | { verified: boolean; admin: boolean } } }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => session }));
const fetchMock = vi.fn();
beforeEach(() => { session.ready = true; session.denied = false; session.profile = null; vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => vi.unstubAllGlobals());
it.each([null, { verified: true, admin: false }, { verified: false, admin: true }])("rejects profile %j without an extra request", profile => {
  session.profile = profile;
  const { result } = renderHook(() => useIsAdmin());
  expect(result.current).toBe(false); expect(fetchMock).not.toHaveBeenCalled();
});
it("removes admin details on role change or revocation", () => {
  session.profile = { verified: true, admin: true };
  const { result, rerender } = renderHook(() => useIsAdmin());
  expect(result.current).toBe(true);
  session.denied = true; rerender(); expect(result.current).toBe(false);
  session.denied = false; session.profile.admin = false; rerender(); expect(result.current).toBe(false);
});
it("resolves shared report access through the account profile and invalidates on logout", async () => {
  session.ready = false;
  fetchMock.mockResolvedValue(Response.json({ verified: true, admin: true }));
  const { result } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(result.current).toBe(true));
  expect(fetchMock).toHaveBeenCalledWith("/api/account/me", expect.objectContaining({ cache: "no-store" }));
  act(() => window.dispatchEvent(new Event("argos-account-invalid")));
  expect(result.current).toBe(false);
});
it("fails closed on service errors and aborts on unmount", async () => {
  session.ready = false; fetchMock.mockRejectedValue(new Error("unavailable"));
  const { result, unmount } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(result.current).toBe(false));
  const signal = fetchMock.mock.calls[0][1].signal; unmount(); expect(signal.aborted).toBe(true);
});
it("ignores a pending admin response after logout", async () => {
  session.ready = false; let resolve!: (response: Response) => void;
  fetchMock.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result } = renderHook(() => useIsAdmin());
  act(() => window.dispatchEvent(new Event("argos-account-invalid")));
  await act(async () => resolve(Response.json({ verified: true, admin: true })));
  expect(result.current).toBe(false);
});
