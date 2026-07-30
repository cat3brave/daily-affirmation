import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type GenerateContentResult = {
  response: {
    text: () => string;
  };
};
type GenerativeModel = {
  generateContent: (prompt: string) => Promise<GenerateContentResult>;
};

const actionMocks = vi.hoisted(() => {
  delete process.env.GEMINI_API_KEY;

  const generateContent =
    vi.fn<(prompt: string) => Promise<GenerateContentResult>>();
  const getGenerativeModel = vi.fn<(config: { model: string }) => GenerativeModel>(
    () => ({ generateContent }),
  );
  const GoogleGenerativeAI = vi.fn(function GoogleGenerativeAI() {
    return {
      getGenerativeModel,
    };
  });

  return {
    generateContent,
    getGenerativeModel,
    GoogleGenerativeAI,
  };
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: actionMocks.GoogleGenerativeAI,
}));

import { generateAffirmation, translateHarshVoice } from "./actions";

const AFFIRMATION_FALLBACK = "あなたは、そのままで素晴らしい存在です。";
const TRANSLATE_FALLBACK =
  "今はAIがお休み中のようです。でも、あなたが一生懸命に頑張っていることは、私がちゃんと知っていますよ。深呼吸してくださいね。";

function createGenerateContentResult(text: string): GenerateContentResult {
  return {
    response: {
      text: () => text,
    },
  };
}

beforeEach(() => {
  actionMocks.generateContent.mockReset();
  actionMocks.getGenerativeModel.mockReset();
  actionMocks.GoogleGenerativeAI.mockClear();

  actionMocks.getGenerativeModel.mockReturnValue({
    generateContent: actionMocks.generateContent,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateAffirmation", () => {
  it("成功時にgemini-2.5-flashと必要条件を含むプロンプトを使い空白を除去して返す", async () => {
    actionMocks.generateContent.mockResolvedValue(
      createGenerateContentResult("  今日はここまでで十分ですよ  "),
    );

    const result = await generateAffirmation();

    expect(actionMocks.getGenerativeModel).toHaveBeenCalledWith({
      model: "gemini-2.5-flash",
    });
    expect(actionMocks.generateContent).toHaveBeenCalledTimes(1);
    const prompt = actionMocks.generateContent.mock.calls[0][0];
    expect(prompt).toContain("心の執事");
    expect(prompt).toContain("5つのお守り言葉");
    expect(prompt).toContain("60点でOK");
    expect(prompt).toContain("30文字以内");
    expect(prompt).toContain("肯定文のみ");
    expect(result).toBe("今日はここまでで十分ですよ");
  });

  it("失敗時にconsole.errorを呼び既存のフォールバック文言を返す", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("generate failed");
    actionMocks.generateContent.mockRejectedValue(error);

    const result = await generateAffirmation();

    expect(consoleError).toHaveBeenCalledWith("Gemini Error:", error);
    expect(result).toBe(AFFIRMATION_FALLBACK);
  });
});

describe("translateHarshVoice", () => {
  it("成功時に入力をtrimして300文字に制限し空白を除去して返す", async () => {
    actionMocks.generateContent.mockResolvedValue(
      createGenerateContentResult("  事実と気持ちを分けて見られていますね  "),
    );
    const limitedInput = "責".repeat(300);
    const result = await translateHarshVoice(`  ${limitedInput}超過  `);

    expect(actionMocks.getGenerativeModel).toHaveBeenCalledWith({
      model: "gemini-2.5-flash",
    });
    expect(actionMocks.generateContent).toHaveBeenCalledTimes(1);
    const prompt = actionMocks.generateContent.mock.calls[0][0];
    expect(prompt).toContain("ヘルシー・アダルト");
    expect(prompt).toContain("客観的な事実");
    expect(prompt).toContain(`「${limitedInput}」`);
    expect(prompt).not.toContain("超過");
    expect(result).toBe("事実と気持ちを分けて見られていますね");
  });

  it("失敗時にconsole.errorを呼び既存のフォールバック文言を返す", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("translate failed");
    actionMocks.generateContent.mockRejectedValue(error);

    const result = await translateHarshVoice("きつい言葉");

    expect(consoleError).toHaveBeenCalledWith("翻訳エラー:", error);
    expect(result).toBe(TRANSLATE_FALLBACK);
  });
});
