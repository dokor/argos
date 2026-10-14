// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useDomainResource, activeStatus } from "./useDomainResource";
const { session } = vi.hoisted(() => ({
  session: { profile: { verified: true }, denied: false, invalidate: vi.fn() },
}));
vi.mock("@/components/account/AccountSession", () => ({
  useAccountSession: () => session,
}));
vi.mock("@/lib/account-client", () => ({
  accountFetch: vi.fn(),
  AccountClientError: class extends Error {
    constructor(
      public code: string,
      public status: number,
      public retryAfter = 0,
    ) {
      super(code);
    }
  },
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(accountFetch).mockReset();
  session.denied = false;
  session.profile.verified = true;
  session.invalidate.mockReset();
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
});
afterEach(() => vi.useRealTimers());
it("never overlaps, aborts an old resource and hides its data while the next loads", async () => {
  vi.mocked(accountFetch)
    .mockResolvedValueOnce({ status: "RUNNING", id: "1" })
    .mockReturnValue(new Promise(() => {}));
  const hook = renderHook(
    ({ path }) =>
      useDomainResource<{ status: string; id: string }>(path, activeStatus),
    { initialProps: { path: "domains/7/batches/1" } },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(hook.result.current.data?.id).toBe("1");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(9000);
  });
  expect(accountFetch).toHaveBeenCalledTimes(2);
  const signal = vi.mocked(accountFetch).mock.calls[1][3];
  hook.rerender({ path: "domains/7/batches/2" });
  expect(signal?.aborted).toBe(true);
  expect(hook.result.current.data).toBeNull();
  hook.unmount();
});
it("pauses hidden tabs, stops on terminal status and retries only on explicit refresh", async () => {
  Object.defineProperty(document, "hidden", {
    value: true,
    configurable: true,
  });
  vi.mocked(accountFetch).mockResolvedValue({ status: "PARTIAL" });
  const hook = renderHook(() =>
    useDomainResource("domains/7/batches/1", activeStatus),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(accountFetch).not.toHaveBeenCalled();
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(accountFetch).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.reload());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(accountFetch).toHaveBeenCalledTimes(2);
});
it("caps transient failures, supports manual retry and masks private results after revocation", async () => {
  vi.mocked(accountFetch).mockRejectedValue(
    new AccountClientError("account_unavailable", 503),
  );
  const hook = renderHook(() =>
    useDomainResource("domains/7/batches/1", activeStatus),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(accountFetch).toHaveBeenCalledTimes(4);
  expect(hook.result.current.error).toBe("account_unavailable");
  vi.mocked(accountFetch).mockResolvedValue({ status: "COMPLETED" });
  act(() => hook.result.current.reload());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(hook.result.current.data).not.toBeNull();
  session.denied = true;
  hook.rerender();
  expect(hook.result.current.data).toBeNull();
});
it("does not retry unauthorized reads or query unverified accounts", async () => {
  vi.mocked(accountFetch).mockRejectedValue(
    new AccountClientError("session_invalid", 401),
  );
  const hook = renderHook(() => useDomainResource("domains", activeStatus));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(accountFetch).toHaveBeenCalledTimes(1);
  expect(session.invalidate).toHaveBeenCalled();
  hook.unmount();
  vi.mocked(accountFetch).mockClear();
  session.profile.verified = false;
  renderHook(() => useDomainResource("domains", activeStatus));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(accountFetch).not.toHaveBeenCalled();
});

it.each([401, 403, 404, 410])(
  "clears an already loaded private resource on permanent HTTP %s",
  async (status) => {
    vi.mocked(accountFetch)
      .mockResolvedValueOnce({ status: "COMPLETED" })
      .mockRejectedValue(
        new AccountClientError("resource_unavailable", status),
      );
    const hook = renderHook(() =>
      useDomainResource("domains/7/batches/1", activeStatus),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hook.result.current.data).not.toBeNull();
    act(() => hook.result.current.reload());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hook.result.current.data).toBeNull();
    expect(hook.result.current.error).toBe("resource_unavailable");
  },
);
