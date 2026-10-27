// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useIsAdmin } from "./useIsAdmin";
const { session } = vi.hoisted(() => ({ session: { ready: true, denied: false, profile: null as null | { verified: boolean; admin: boolean } } }));
vi.mock("@/components/account/AccountSession", () => ({ useAccountSession: () => session }));
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("./account-client", () => ({ accountFetch: fetchMock }));
beforeEach(() => { session.ready = true; session.denied = false; session.profile = null; fetchMock.mockReset(); });
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
  fetchMock.mockResolvedValueOnce({ signedIn: true }).mockResolvedValue({ verified: true, admin: true });
  const { result } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(result.current).toBe(true));
  expect(fetchMock).toHaveBeenCalledWith("me", "GET", undefined, expect.any(AbortSignal));
  act(() => window.dispatchEvent(new Event("argos-account-invalid")));
  expect(result.current).toBe(false);
});
it("reads only passive status for anonymous public report readers", async () => {
  session.ready = false;
  fetchMock.mockResolvedValue({ signedIn: false });
  const { result } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(result.current).toBe(false));
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("session", "GET", undefined, expect.any(AbortSignal));
});
it("fails closed on service errors and aborts on unmount", async () => {
  session.ready = false; fetchMock.mockRejectedValue(new Error("unavailable"));
  const { result, unmount } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(result.current).toBe(false));
  const signal = fetchMock.mock.calls[0][3]; unmount(); expect(signal.aborted).toBe(true);
});
it("ignores a pending admin response after logout", async () => {
  session.ready = false; let resolve!: (profile: {verified: boolean; admin: boolean}) => void;
  fetchMock.mockResolvedValueOnce({ signedIn: true }).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const { result } = renderHook(() => useIsAdmin());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  act(() => window.dispatchEvent(new Event("argos-account-invalid")));
  await act(async () => resolve({ verified: true, admin: true }));
  expect(result.current).toBe(false);
});
