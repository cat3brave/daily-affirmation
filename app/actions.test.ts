import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type GenerateContentResult = { response: { text: () => string } };
type GenerativeModel = {
  generateContent: (prompt: string) => Promise<GenerateContentResult>;
};

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const getUser = vi.fn(async () => {
    events.push("auth");
    return { data: { user: { id: "user-1" } }, error: null };
  });
  const createSupabaseServerClient = vi.fn(async () => ({ auth: { getUser } }));
  const generateContent = vi.fn<(prompt: string) => Promise<GenerateContentResult>>();
  const getGenerativeModel = vi.fn<(config: { model: string }) => GenerativeModel>(
    () => {
      events.push("model");
      return { generateContent };
    },
  );
  const GoogleGenerativeAI = vi.fn(function GoogleGenerativeAI() {
    return { getGenerativeModel };
  });
  return {
    events,
    getUser,
    createSupabaseServerClient,
    generateContent,
    getGenerativeModel,
    GoogleGenerativeAI,
  };
});

vi.mock("./lib/supabaseServer", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: mocks.GoogleGenerativeAI,
}));

import { generateAffirmation, translateHarshVoice } from "./actions";

const AFFIRMATION_FALLBACK = "あなたは、そのままで素晴らしい存在です。";
const TRANSLATE_FALLBACK =
  "今はAIがお休み中のようです。でも、あなたが一生懸命に頑張っていることは、私がちゃんと知っていますよ。深呼吸してくださいね。";
const AUTH_MESSAGE =
  "ログイン状態を確認できませんでした。ログインし直してください。";

function result(text: string): GenerateContentResult {
  return { response: { text: () => text } };
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-api-key";
  mocks.events.length = 0;
  mocks.getUser.mockReset();
  mocks.getUser.mockImplementation(async () => {
    mocks.events.push("auth");
    return { data: { user: { id: "user-1" } }, error: null };
  });
  mocks.createSupabaseServerClient.mockReset();
  mocks.createSupabaseServerClient.mockImplementation(async () => ({
    auth: { getUser: mocks.getUser },
  }));
  mocks.generateContent.mockReset();
  mocks.getGenerativeModel.mockClear();
  mocks.getGenerativeModel.mockImplementation(() => {
    mocks.events.push("model");
    return { generateContent: mocks.generateContent };
  });
  mocks.GoogleGenerativeAI.mockClear();
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

function expectGeminiNotCalled() {
  expect(mocks.GoogleGenerativeAI).not.toHaveBeenCalled();
  expect(mocks.getGenerativeModel).not.toHaveBeenCalled();
  expect(mocks.generateContent).not.toHaveBeenCalled();
}

describe("generateAffirmation", () => {
  it("認証後にGeminiを1回呼び正常結果を返す", async () => {
    mocks.generateContent.mockResolvedValue(result("  今日は十分ですよ  "));

    await expect(generateAffirmation()).resolves.toEqual({
      status: "success",
      text: "今日は十分ですよ",
    });
    expect(mocks.events).toEqual(["auth", "model"]);
    expect(mocks.generateContent).toHaveBeenCalledOnce();
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
    mocks.createSupabaseServerClient.mockRejectedValue(new Error("internal-key"));
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
});

describe("translateHarshVoice", () => {
  it("入力をtrimして300文字に制限し正常結果を返す", async () => {
    mocks.generateContent.mockResolvedValue(result("  優しい言葉です  "));
    const limited = "責".repeat(300);

    await expect(translateHarshVoice(`  ${limited}超過  `)).resolves.toEqual({
      status: "success",
      text: "優しい言葉です",
    });
    const prompt = mocks.generateContent.mock.calls[0][0];
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
});
