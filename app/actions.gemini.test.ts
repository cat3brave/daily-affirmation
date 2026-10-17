// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeminiActionResult } from "./actions";
import { GEMINI_TIMEOUT_MS } from "./lib/geminiRequest";

const auth = vi.hoisted(() => ({ getAuthenticatedContext: vi.fn(), rpc: vi.fn(), retry: vi.fn() }));
vi.mock("./lib/supabaseServer", () => auth);
// The Gemini SDK is real. Only the network boundary is replaced.
import { generateAffirmation, translateHarshVoice } from "./actions";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const payload = { candidates: [{ content: { parts: [{ text: "  優しい言葉  " }], role: "model" } }] };
const timeoutMessage = "応答に時間がかかっています。少し時間をおいて、もう一度お試しください。";
const actions = [
  { name: "generateAffirmation", call: generateAffirmation, fallback: "あなたは、そのままで素晴らしい存在です。" },
  { name: "translateHarshVoice", call: () => translateHarshVoice("private-input-secret"), fallback: "今はAIがお休み中のようです。でも、あなたが一生懸命に頑張っていることは、私がちゃんと知っていますよ。深呼吸してくださいね。" },
];
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("GEMINI_API_KEY", "private-api-key-secret");
  auth.retry.mockResolvedValue({ data: [{ allowed: true, reason: "allowed", daily_remaining: 19, minute_remaining: 2, retry_at: null }], error: null });
  auth.rpc.mockImplementation(() => ({ abortSignal: () => ({ retry: auth.retry }) }));
  auth.getAuthenticatedContext.mockResolvedValue({ user: { id: "test-user" }, supabase: { rpc: auth.rpc } });
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function start(call: () => Promise<GeminiActionResult>) {
  const pending = call();
  void pending.catch(() => undefined);
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledOnce();
  return { pending };
}
function trackListeners() {
  const add = vi.spyOn(AbortSignal.prototype, "addEventListener");
  const remove = vi.spyOn(AbortSignal.prototype, "removeEventListener");
  return () => {
    // All SDK listeners registered on the supplied signal must be removed.
    add.mock.calls.forEach(([type, listener, options], index) => {
      expect(remove.mock.calls.some((args, i) => remove.mock.contexts[i] === add.mock.contexts[index] &&
        args[0] === type && args[1] === listener && args[2] === options)).toBe(true);
    });
    expect(vi.getTimerCount()).toBe(0);
  };
}

describe.each(actions)("$name with real SDK and mock fetch", ({ call, fallback }) => {
  it("succeeds before the deadline and removes the timer/listener", async () => {
    const checkCleanup = trackListeners();
    const body = deferred<typeof payload>();
    fetchMock.mockResolvedValue({ ok: true, json: () => body.promise } as Response);
    const { pending } = await start(call);
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS - 1);
    body.resolve(payload);
    await expect(pending).resolves.toEqual({ status: "success", text: "優しい言葉" });
    checkCleanup();
  });

  it("keeps ordinary failures safe and cleans up", async () => {
    const checkCleanup = trackListeners();
    fetchMock.mockRejectedValue(new Error("internal token private-api-key-secret private-input-secret"));
    const result = await call();
    expect(result).toEqual({ status: "fallback", text: fallback });
    expect(JSON.stringify(result)).not.toMatch(/secret|internal|token/);
    checkCleanup();
  });

  it("propagates abort to a nonresponding fetch and returns at the deadline", async () => {
    const checkCleanup = trackListeners();
    let observedAbort = false;
    let transportSignal!: AbortSignal;
    fetchMock.mockImplementation((_url, options) => {
      transportSignal = options!.signal!;
      return new Promise((_resolve, reject) => {
        const abort = () => {
          transportSignal.removeEventListener("abort", abort);
          observedAbort = true;
          reject(new DOMException("private token-secret", "AbortError"));
        };
        transportSignal.addEventListener("abort", abort);
      });
    });
    const { pending } = await start(call);
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS - 1);
    expect(transportSignal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(observedAbort).toBe(true);
    expect(transportSignal.aborted).toBe(true);
    expect(await pending).toEqual({ status: "timed_out", message: timeoutMessage, text: fallback });
    checkCleanup();
  });

  it("aborts while waiting for the response body", async () => {
    const checkCleanup = trackListeners();
    const body = deferred<typeof payload>();
    let observedAbort = false;
    fetchMock.mockImplementation(async (_url, options) => {
      const signal = options!.signal!;
      const once = { once: true, capture: false };
      const abort = () => { observedAbort = true; body.reject(new DOMException("body-secret", "AbortError")); };
      signal.addEventListener("abort", abort, once);
      return { ok: true, json: () => body.promise.finally(() => signal.removeEventListener("abort", abort, once)) } as Response;
    });
    const { pending } = await start(call);
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS);
    expect(observedAbort).toBe(true);
    expect(await pending).toEqual({ status: "timed_out", message: timeoutMessage, text: fallback });
    checkCleanup();
  });

  it.each(["headers", "body"])("ignores late success/failure during %s, without unhandled rejections", async (phase) => {
    const checkCleanup = trackListeners();
    const late = deferred<Response>();
    const body = deferred<typeof payload>();
    fetchMock.mockImplementation(() => phase === "headers" ? late.promise : Promise.resolve({ ok: true, json: () => body.promise } as Response));
    const { pending } = await start(call);
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS);
    const result = await pending;
    expect(result).toEqual({ status: "timed_out", message: timeoutMessage, text: fallback });
    checkCleanup();
    late.resolve({ ok: true, json: async () => payload } as Response);
    body.resolve(payload);
    await vi.advanceTimersByTimeAsync(0);
    expect(await pending).toBe(result);
    expect(fetchMock).toHaveBeenCalledOnce();

    fetchMock.mockClear();
    const lateFailure = deferred<Response>();
    const failedBody = deferred<typeof payload>();
    fetchMock.mockImplementation(() => phase === "headers" ? lateFailure.promise : Promise.resolve({ ok: true, json: () => failedBody.promise } as Response));
    const next = (await start(call)).pending;
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS);
    const nextResult = await next;
    if (phase === "headers") lateFailure.reject(new Error("late token-secret"));
    else failedBody.reject(new Error("late private-input-secret"));
    await vi.advanceTimersByTimeAsync(0);
    expect(await next).toBe(nextResult);
    checkCleanup();
    // Vitest also fails this test suite if a late rejection is unhandled.
  });

  it("preserves structured SDK 429 results without exposing response details", async () => {
    const checkCleanup = trackListeners();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: "private-input-secret private-api-key-secret" } }), { status: 429 }));
    const result = await call();
    expect(result.status).toBe("rate_limited");
    expect(auth.rpc).toHaveBeenCalledExactlyOnceWith("reserve_ai_usage");
    expect(JSON.stringify(result)).not.toMatch(/secret/);
    checkCleanup();
  });

  it("does not invoke fetch without authentication or API key", async () => {
    auth.getAuthenticatedContext.mockResolvedValueOnce(null);
    expect((await call()).status).toBe("auth_required");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await call()).toEqual({ status: "fallback", text: fallback });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

it.each(["", "   ", null, 42])("rejects invalid translation input %j before auth or network", async (input) => {
  expect((await translateHarshVoice(input as string)).status).toBe("invalid_input");
  expect(auth.getAuthenticatedContext).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
