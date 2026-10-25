import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type GenerateContentResult = { candidates: { content: { parts: { text: string }[] } }[] };
type GenerateParams = { model: string; contents: string };
type AuthResult = {
  data: { user: { id: string } | null };
  error: Error | null;
};

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const getUser = vi.fn<() => Promise<AuthResult>>(async () => {
    events.push("auth");
    return { data: { user: { id: "user-1" } }, error: null };
  });
  const retry = vi.fn();
  const abortSignal = vi.fn(() => ({ retry }));
  const rpc = vi.fn(() => { events.push("rpc"); return { abortSignal }; });
  const createSupabaseServerClient = vi.fn(() => ({ auth: { getUser } }));
  const generateContent = vi.fn<(params: GenerateParams) => Promise<GenerateContentResult>>();
  const GoogleGenAI = vi.fn(function GoogleGenAI() {
    events.push("model");
    return { models: { generateContent } };
  });
  return {
    events,
    rpc, abortSignal, retry,
    getUser,
    createSupabaseServerClient,
    generateContent,
    GoogleGenAI,
  };
});

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createSupabaseServerClient }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: mocks.GoogleGenAI,
}));

import { generateAffirmation, translateHarshVoice } from "./actions";

const AFFIRMATION_FALLBACK = "あなたは、そのままで素晴らしい存在です。";
const TRANSLATE_FALLBACK =
  "今はAIがお休み中のようです。でも、あなたが一生懸命に頑張っていることは、私がちゃんと知っていますよ。深呼吸してくださいね。";
const AUTH_MESSAGE =
  "ログイン状態を確認できませんでした。ログインし直してください。";
const RATE_LIMIT_MESSAGE =
  "利用が集中しています。少し時間をおいてから、もう一度お試しください。";

function result(text: string): GenerateContentResult {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  process.env.GEMINI_API_KEY = "test-api-key";
  mocks.events.length = 0;
  mocks.getUser.mockReset();
  mocks.getUser.mockImplementation(async () => {
    mocks.events.push("auth");
    return { data: { user: { id: "user-1" } }, error: null };
  });
  mocks.createSupabaseServerClient.mockReset();
  mocks.createSupabaseServerClient.mockImplementation(() => ({
    auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  }));
  mocks.rpc.mockClear();
  mocks.rpc.mockImplementation(() => { mocks.events.push("rpc"); return { abortSignal: mocks.abortSignal }; });
  mocks.abortSignal.mockImplementation(() => ({ retry: mocks.retry }));
  mocks.retry.mockResolvedValue({ data: [{ allowed: true, reason: "allowed", daily_remaining: 19, minute_remaining: 2, retry_at: null }], error: null });
  mocks.generateContent.mockReset();
  mocks.GoogleGenAI.mockReset();
  mocks.GoogleGenAI.mockImplementation(function () {
    mocks.events.push("model");
    return { models: { generateContent: mocks.generateContent } };
  });
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

function expectGeminiNotCalled() {
  expect(mocks.GoogleGenAI).not.toHaveBeenCalled();
  expect(mocks.generateContent).not.toHaveBeenCalled();
}

describe("generateAffirmation", () => {
  it("認証後にGeminiを1回呼び正常結果を返す", async () => {
    mocks.generateContent.mockResolvedValue(result("  今日は十分ですよ  "));

    await expect(generateAffirmation()).resolves.toEqual({
      status: "success",
      text: "今日は十分ですよ",
    });
    expect(mocks.events).toEqual(["auth", "rpc", "model"]);
    expect(mocks.generateContent).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reserve_ai_usage");
    expect(mocks.createSupabaseServerClient).toHaveBeenCalledOnce();
    expect(mocks.retry).toHaveBeenCalledWith(false);
  });

  it.each([
    ["ユーザーなし", { data: { user: null }, error: null }],
    ["getUserエラー", { data: { user: null }, error: new Error("token-secret") }],
  ])("%sではGeminiを呼ばない", async (_name, authResult) => {
    mocks.getUser.mockResolvedValue(authResult);

    await expect(generateAffirmation()).resolves.toEqual({
      status: "auth_required",
      message: AUTH_MESSAGE,
    });
    expectGeminiNotCalled();
  });

  it("認証確認の例外ではGeminiを呼ばず詳細を返さない", async () => {
    mocks.getUser.mockRejectedValue(new Error("access-token-secret"));
    const actionResult = await generateAffirmation();

    expect(actionResult).toEqual({ status: "auth_required", message: AUTH_MESSAGE });
    expect(JSON.stringify(actionResult)).not.toContain("access-token-secret");
    expectGeminiNotCalled();
  });

  it("Supabase初期化の例外でも安全に失敗する", async () => {
    mocks.createSupabaseServerClient.mockImplementation(() => { throw new Error("internal-key"); });
    const actionResult = await generateAffirmation();

    expect(JSON.stringify(actionResult)).not.toContain("internal-key");
    expectGeminiNotCalled();
  });

  it("APIキーがない場合は外部呼び出しせずフォールバックを返す", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(generateAffirmation()).resolves.toEqual({
      status: "fallback",
      text: AFFIRMATION_FALLBACK,
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expectGeminiNotCalled();
  });

  it("Gemini障害時は既存フォールバックを返し詳細を含めない", async () => {
    mocks.generateContent.mockRejectedValue(new Error("api-key-secret"));
    const actionResult = await generateAffirmation();

    expect(actionResult).toEqual({ status: "fallback", text: AFFIRMATION_FALLBACK });
    expect(JSON.stringify(actionResult)).not.toContain("api-key-secret");
  });

  it.each([
    [{ status: 429, message: "api-key-secret" }],
    [{ code: "RESOURCE_EXHAUSTED", details: "token-secret" }],
    [{ response: { status: "429" }, message: "prompt-secret" }],
  ])("構造化された利用制限を安全なrate_limitedへ変換する", async (error) => {
    mocks.generateContent.mockRejectedValue(error);

    const actionResult = await generateAffirmation();

    expect(actionResult).toEqual({
      status: "rate_limited",
      message: RATE_LIMIT_MESSAGE,
    });
    expect(JSON.stringify(actionResult)).not.toMatch(/api-key|token|prompt/);
  });
});

describe("translateHarshVoice", () => {
  it("入力をtrimして300文字に制限し正常結果を返す", async () => {
    mocks.generateContent.mockResolvedValue(result("  優しい言葉です  "));
    const limited = "責".repeat(300);

    await expect(translateHarshVoice(`  ${limited}超過  `)).resolves.toEqual({
      status: "success",
      text: "優しい言葉です",
    });
    const prompt = mocks.generateContent.mock.calls[0][0].contents;
    expect(prompt).toContain(`「${limited}」`);
    expect(prompt).not.toContain("超過");
  });

  it.each(["", "   "])("空入力 %j は認証もGeminiも呼ばない", async (input) => {
    await expect(translateHarshVoice(input)).resolves.toEqual({
      status: "invalid_input",
      message: "入力内容を確認してください。",
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expectGeminiNotCalled();
  });

  it("未認証ではGeminiを呼ばない", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(translateHarshVoice("つらい声")).resolves.toEqual({
      status: "auth_required",
      message: AUTH_MESSAGE,
    });
    expectGeminiNotCalled();
  });

  it("Gemini障害時は既存フォールバックを返す", async () => {
    mocks.generateContent.mockRejectedValue(new Error("failed"));

    await expect(translateHarshVoice("つらい声")).resolves.toEqual({
      status: "fallback",
      text: TRANSLATE_FALLBACK,
    });
  });

  it("構造化された429エラーを安全なrate_limitedへ変換する", async () => {
    mocks.generateContent.mockRejectedValue({
      code: 429,
      message: "sdk internal token-secret prompt-secret",
    });

    const actionResult = await translateHarshVoice("つらい声");

    expect(actionResult).toEqual({
      status: "rate_limited",
      message: RATE_LIMIT_MESSAGE,
    });
    expect(JSON.stringify(actionResult)).not.toMatch(/internal|token|prompt/);
  });
});

const calls = [generateAffirmation, () => translateHarshVoice("private-input-secret")];
describe.each(calls)("usage guard", (call) => {
  it.each([
    ["minute_limit", 19, 0], ["daily_limit", 0, 2], ["daily_and_minute_limit", 0, 0],
  ])("returns %s without creating Gemini", async (reason, daily, minute) => {
    mocks.retry.mockResolvedValue({ data: [{ allowed: false, reason, daily_remaining: daily, minute_remaining: minute, retry_at: "2026-10-18T15:00:00+00:00" }], error: null });
    const response = await call();
    expect(response).toMatchObject({ status: "usage_limited", reason, retryAt: "2026-10-18T15:00:00+00:00" });
    expect(response).toHaveProperty("message", expect.stringContaining("2026/10/19 00:00:00（日本時間）"));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reserve_ai_usage");
    expectGeminiNotCalled();
  });
  it.each(["missing user", "auth error", "auth exception", "no API key"])("skips RPC for %s", async (kind) => {
    if (kind === "missing user") mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    if (kind === "auth error") mocks.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: new Error("secret") });
    if (kind === "auth exception") mocks.getUser.mockRejectedValue(new Error("secret"));
    if (kind === "no API key") delete process.env.GEMINI_API_KEY;
    await call();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expectGeminiNotCalled();
  });
  it.each(["error", "exception", "null"])("fails closed on RPC %s", async (kind) => {
    if (kind === "error") mocks.retry.mockResolvedValue({ data: [], error: new Error("internal cookie JWT api-key-secret") });
    if (kind === "exception") mocks.rpc.mockImplementation(() => { throw new Error("internal cookie JWT api-key-secret"); });
    if (kind === "null") mocks.retry.mockResolvedValue({ data: null, error: null });
    const log = vi.spyOn(console, "error");
    const response = await call();
    expect(response).toEqual({ status: "usage_unavailable", message: "利用状況を確認できませんでした。時間をおいて再度お試しください。" });
    expect(log).not.toHaveBeenCalled();
    expectGeminiNotCalled();
  });
  it.each(["success", "429", "exception"])("never reserves again or refunds after Gemini %s", async (kind) => {
    if (kind === "success") mocks.generateContent.mockResolvedValue(result("ok"));
    else mocks.generateContent.mockRejectedValue(kind === "429" ? { status: 429 } : new Error("secret"));
    await call();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reserve_ai_usage");
  });
});

it.each(calls)("RPCの5秒期限後の応答ではGeminiを作成しない", async (call) => {
  vi.useFakeTimers();
  let resolve!: (value: unknown) => void;
  mocks.retry.mockReturnValue(new Promise((done) => { resolve = done; }));
  try {
    const pending = call();
    await vi.advanceTimersByTimeAsync(5000);
    const response = await pending;
    expect(response).toMatchObject({ status: "usage_unavailable" });
    expectGeminiNotCalled();
    resolve({ data: [{ allowed: true, reason: "allowed", daily_remaining: 19, minute_remaining: 2, retry_at: null }], error: null });
    await vi.advanceTimersByTimeAsync(0);
    expectGeminiNotCalled();
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});

// Client construction and response processing are inside the safe action boundary.
describe.each(calls)("SDK boundary exceptions", call => {
  it("converts construction failures to the existing fallback", async () => {
    mocks.GoogleGenAI.mockImplementation(() => { throw new Error("private-key-secret"); });
    const response = await call();
    expect(response.status).toBe("fallback");
    expect(JSON.stringify(response)).not.toContain("secret");
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });
  it("converts response access failures to the existing fallback", async () => {
    mocks.generateContent.mockResolvedValue({ get candidates(): never { throw new Error("private-input-secret"); } });
    expect((await call()).status).toBe("fallback");
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
