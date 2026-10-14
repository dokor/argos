"use client";
import { useEffect, useState, useCallback } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession } from "@/components/account/AccountSession";
export const activeStatus = (value: { status: string }) =>
  ["QUEUED", "RUNNING"].includes(value.status);
export const followPages = () => true;
/** One request at a time, bounded retries, hidden-tab pause, terminal stop and abort on navigation. */
export function useDomainResource<T>(
  path: string | null,
  poll?: (data: T) => boolean,
) {
  const { profile, denied, invalidate } = useAccountSession(),
    allowed = !!profile?.verified && !denied;
  const [result, setResult] = useState<{ path: string; data: T } | null>(null),
    [failure, setFailure] = useState<{ path: string; code: string } | null>(
      null,
    ),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState<string | null>(null);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!allowed || !path) return;
    const key = path,
      controller = new AbortController();
    let alive = true,
      inflight = false,
      terminal = false,
      retries = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      if (alive && !terminal && !document.hidden)
        timer = setTimeout(load, delay);
    };
    async function load() {
      if (!alive || inflight || terminal || document.hidden) return;
      inflight = true;
      setLoading(key);
      try {
        const data = await accountFetch<T>(
          key,
          "GET",
          undefined,
          controller.signal,
        );
        if (!alive) return;
        setResult({ path: key, data });
        setFailure(null);
        retries = 0;
        terminal = !poll?.(data);
        schedule(2000);
      } catch (reason) {
        if (!alive) return;
        invalidate(reason);
        if (
          reason instanceof AccountClientError &&
          [401, 403, 404, 410].includes(reason.status)
        )
          setResult(null);
        const transient =
          !(reason instanceof AccountClientError) ||
          reason.status === 429 ||
          reason.status >= 500;
        setFailure({
          path: key,
          code:
            reason instanceof AccountClientError
              ? reason.code
              : "account_unavailable",
        });
        if (transient && ++retries <= 3)
          schedule(
            Math.max(
              2000 * 2 ** retries,
              reason instanceof AccountClientError
                ? reason.retryAfter * 1000
                : 0,
            ),
          );
        else terminal = true;
      } finally {
        inflight = false;
        if (alive) setLoading(null);
      }
    }
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void load();
    };
    queueMicrotask(() => {
      if (alive) void load();
    });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [path, allowed, invalidate, revision, poll]);
  return {
    data: allowed && result?.path === path ? result.data : null,
    error: allowed && failure?.path === path ? failure.code : "",
    loading: loading === path,
    reload,
    allowed,
  };
}
