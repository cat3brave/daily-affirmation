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
function responseBody(json: () => Promise<unknown>) {
  const response = new Response();
  response.json = json;
  return response;
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
    fetchMock.mockResolvedValue(responseBody(() => body.promise));
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
      return responseBody(() => body.promise.finally(() => signal.removeEventListener("abort", abort, once)));
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
    fetchMock.mockImplementation(() => phase === "headers" ? late.promise : Promise.resolve(responseBody(() => body.promise)));
    const { pending } = await start(call);
    await vi.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS);
    const result = await pending;
    expect(result).toEqual({ status: "timed_out", message: timeoutMessage, text: fallback });
    checkCleanup();
    late.resolve(responseBody(async () => payload));
    body.resolve(payload);
    await vi.advanceTimersByTimeAsync(0);
    expect(await pending).toBe(result);
    expect(fetchMock).toHaveBeenCalledOnce();

    fetchMock.mockClear();
    const lateFailure = deferred<Response>();
    const failedBody = deferred<typeof payload>();
    fetchMock.mockImplementation(() => phase === "headers" ? lateFailure.promise : Promise.resolve(responseBody(() => failedBody.promise)));
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

  it.each([429, 500, 503, 400, 404])("sends one HTTP request for API status %s", async (status) => {
    const cleanup = trackListeners();
    const logs = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log")];
    fetchMock.mockResolvedValue(Response.json({ error: { code: status, message: "private-api-key-secret private-input-secret" } }, { status }));
    const result = await call();
    expect(result.status).toBe(status === 429 ? "rate_limited" : "fallback");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(auth.rpc).toHaveBeenCalledExactlyOnceWith("reserve_ai_usage");
    expect(JSON.stringify(result)).not.toMatch(/secret/);
    logs.forEach(log => expect(log).not.toHaveBeenCalled());
    cleanup();
  });

  it.each([
    {}, { candidates: [] },
    { candidates: [{ content: { parts: [] } }] },
    { candidates: [{ content: { parts: [{ text: "   " }] } }] },
    { candidates: [{ content: { parts: [{ text: 42 }] } }] },
    { candidates: [{ content: { parts: [{ text: "private-input-secret", thought: true }] } }] },
    { candidates: [{ content: { parts: [{ functionCall: { name: "private-input-secret" } }] } }] },
    { candidates: [{ finishReason: "SAFETY", content: { parts: [{ text: "partial" }] } }] },
    { candidates: [{ finishReason: "CONTINUATION", continuationToken: "private-api-key-secret", content: { parts: [{ text: "partial" }] } }] },
  ])("rejects unusable text safely without continuation %#", async (body) => {
    const cleanup = trackListeners();
    const logs = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log")];
    fetchMock.mockResolvedValue(Response.json(body));
    expect(await call()).toEqual({ status: "fallback", text: fallback });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    logs.forEach(log => expect(log).not.toHaveBeenCalled());
    cleanup();
  });

  it.each(["denied", "error", "exception", "malformed"])("makes no generation request when quota is %s", async (kind) => {
    if (kind === "denied") auth.retry.mockResolvedValue({ data: [{ allowed: false, reason: "daily_limit", daily_remaining: 0, minute_remaining: 2, retry_at: "2026-10-18T15:00:00Z" }], error: null });
    if (kind === "error") auth.retry.mockResolvedValue({ data: null, error: new Error("secret") });
    if (kind === "exception") auth.retry.mockRejectedValue(new Error("secret"));
    if (kind === "malformed") auth.retry.mockResolvedValue({ data: [], error: null });
    expect((await call()).status).toBe(kind === "denied" ? "usage_limited" : "usage_unavailable");
    expect(auth.rpc).toHaveBeenCalledExactlyOnceWith("reserve_ai_usage");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reserves quota before sending the unchanged model and prompt", async () => {
    fetchMock.mockImplementation(async (url, init) => {
      expect(auth.rpc).toHaveBeenCalledExactlyOnceWith("reserve_ai_usage");
      expect(auth.retry).toHaveBeenCalledOnce();
      expect(String(url)).toContain("gemini-2.5-flash:generateContent");
      const body = JSON.parse(init!.body as string);
      expect(body.contents[0].parts[0].text).toBeTypeOf("string");
      return Response.json(payload);
    });
    expect(await call()).toEqual({ status: "success", text: "優しい言葉" });
    expect(fetchMock).toHaveBeenCalledOnce();
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
