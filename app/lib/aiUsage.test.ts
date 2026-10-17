// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_USAGE_TIMEOUT_MS, reserveAiUsage } from "./aiUsage";
import type { createSupabaseServerClient } from "./supabaseServer";
const allowed = { allowed: true, reason: "allowed", daily_remaining: 19, minute_remaining: 2, retry_at: null };
const denied = { allowed: false, reason: "minute_limit", daily_remaining: 19, minute_remaining: 0, retry_at: "2026-10-18T00:01:00Z" };
function setup(response: unknown) {
  const retry = vi.fn().mockResolvedValue(response);
  const abortSignal = vi.fn((signal: AbortSignal) => { void signal; return { retry }; });
  const rpc = vi.fn(() => ({ abortSignal }));
  const client = { rpc } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>;
  return { client, rpc, retry, abortSignal };
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (value: Error) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });

describe("RPC contract", () => {
  it.each([allowed, { ...allowed, daily_remaining: 0, minute_remaining: 0 }])("accepts post-reservation allowed row %j", async (row) => {
    const mock = setup({ data: [row], error: null });
    await expect(reserveAiUsage(mock.client)).resolves.toBeNull();
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("reserve_ai_usage");
    expect(mock.retry).toHaveBeenCalledExactlyOnceWith(false);
    expect(mock.abortSignal.mock.calls[0][0].aborted).toBe(false);
  });
  it.each([
    null, [], [allowed, allowed], {}, [null], ["allowed"],
    [{ ...allowed, allowed: "true" }], [{ ...allowed, reason: "unknown" }],
    [{ ...allowed, daily_remaining: 20 }], [{ ...allowed, minute_remaining: 3 }],
    [{ ...allowed, daily_remaining: -1 }], [{ ...allowed, daily_remaining: 1.5 }],
    [{ ...allowed, daily_remaining: "19" }], [{ ...allowed, minute_remaining: NaN }],
    [{ ...allowed, minute_remaining: 0.5 }], [{ ...allowed, minute_remaining: -1 }],
    [{ ...allowed, retry_at: "2026-10-18T00:00:00Z" }], [{ ...allowed, allowed: false }],
    [{ ...denied, retry_at: null }], [{ ...denied, retry_at: "tomorrow" }],
    [{ ...denied, retry_at: "2026-10-18" }], [{ ...denied, retry_at: 42 }],
    [{ ...denied, retry_at: "2026-02-30T00:00:00Z" }],
    [{ ...denied, retry_at: "2026-10-18T24:00:00Z" }],
    [{ ...denied, retry_at: "2026-00-18T00:00:00Z" }],
    [{ ...denied, daily_remaining: 21 }], [{ ...denied, minute_remaining: 4 }],
    [{ ...denied, daily_remaining: 0 }], [{ ...denied, minute_remaining: 1 }],
    [{ ...denied, reason: "daily_limit" }], [{ ...denied, reason: "daily_and_minute_limit" }],
  ])("rejects malformed or inconsistent response %j", async (data) => {
    const mock = setup({ data, error: null });
    await expect(reserveAiUsage(mock.client)).resolves.toMatchObject({ status: "usage_unavailable" });
    expect(mock.rpc).toHaveBeenCalledOnce();
  });
  it.each(["resolve", "reject"])("ignores late %s and aborts exactly at five seconds", async (settlement) => {
    const late = deferred();
    const mock = setup(null);
    mock.retry.mockReturnValue(late.promise);
    const pending = reserveAiUsage(mock.client);
    await vi.advanceTimersByTimeAsync(AI_USAGE_TIMEOUT_MS - 1);
    const signal = mock.abortSignal.mock.calls[0][0];
    expect(signal.aborted).toBe(false);
    const onAbort = vi.fn();
    signal.addEventListener("abort", onAbort, { once: true });
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(result).toMatchObject({ status: "usage_unavailable" });
    expect(onAbort).toHaveBeenCalledOnce();
    expect(signal.aborted).toBe(true);
    if (settlement === "resolve") late.resolve({ data: [allowed], error: null });
    else late.reject(new Error("internal JWT cookie secret"));
    await vi.advanceTimersByTimeAsync(0);
    expect(await pending).toBe(result);
    expect(mock.rpc).toHaveBeenCalledOnce();
  });
  it("catches asynchronous rejection and clears the deadline", async () => {
    const mock = setup(null);
    mock.retry.mockRejectedValue(new Error("secret"));
    await expect(reserveAiUsage(mock.client)).resolves.toMatchObject({ status: "usage_unavailable" });
  });
});
