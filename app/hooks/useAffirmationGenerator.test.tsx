import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeminiActionResult } from "../actions";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const affirmationMocks = vi.hoisted(() => {
  const generateAffirmation = vi.fn<() => Promise<GeminiActionResult>>();

  return {
    generateAffirmation,
  };
});

vi.mock("../actions", () => ({
  generateAffirmation: affirmationMocks.generateAffirmation,
}));

import { useAffirmationGenerator } from "./useAffirmationGenerator";

const HOOK_FALLBACK = "深呼吸して、もう一度試してみてくださいね。";

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"] | undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  if (!resolve) {
    throw new Error("Deferred promise was not initialized.");
  }

  return { promise, resolve };
}

beforeEach(() => {
  affirmationMocks.generateAffirmation.mockReset();
  affirmationMocks.generateAffirmation.mockResolvedValue({ status: "success", text: "今日はここまでで十分ですよ" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useAffirmationGenerator", () => {
  it("生成成功時に結果をtextへ反映しisLoadingを解除する", async () => {
    affirmationMocks.generateAffirmation.mockResolvedValue({
      status: "success",
      text: "私は私の作業を進めれば十分ですよ",
    });
    const { result } = renderHook(() => useAffirmationGenerator());

    await act(async () => {
      await result.current.handleGenerateAffirmation();
    });

    expect(result.current.text).toBe("私は私の作業を進めれば十分ですよ");
    expect(result.current.isLoading).toBe(false);
  });

  it("生成中はisLoading=trueになり以前のtextを空にする", async () => {
    affirmationMocks.generateAffirmation.mockResolvedValueOnce({ status: "success", text: "前の言葉です" });
    const { result } = renderHook(() => useAffirmationGenerator());

    await act(async () => {
      await result.current.handleGenerateAffirmation();
    });
    expect(result.current.text).toBe("前の言葉です");

    const generateDeferred = createDeferred<GeminiActionResult>();
    affirmationMocks.generateAffirmation.mockReturnValueOnce(
      generateDeferred.promise,
    );

    act(() => {
      void result.current.handleGenerateAffirmation();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    expect(result.current.text).toBe("");

    await act(async () => {
      generateDeferred.resolve({ status: "success", text: "新しい言葉です" });
      await generateDeferred.promise;
    });

    expect(result.current.text).toBe("新しい言葉です");
    expect(result.current.isLoading).toBe(false);
  });

  it("generateAffirmationがthrowした場合フォールバック文言を表示して再操作可能に戻る", async () => {
    affirmationMocks.generateAffirmation.mockRejectedValueOnce(
      new Error("generate failed"),
    );
    const { result } = renderHook(() => useAffirmationGenerator());

    await act(async () => {
      await result.current.handleGenerateAffirmation();
    });

    expect(result.current.text).toBe(HOOK_FALLBACK);
    expect(result.current.isLoading).toBe(false);

    affirmationMocks.generateAffirmation.mockResolvedValueOnce({ status: "success", text: "再生成できました" });

    await act(async () => {
      await result.current.handleGenerateAffirmation();
    });

    expect(affirmationMocks.generateAffirmation).toHaveBeenCalledTimes(2);
    expect(result.current.text).toBe("再生成できました");
    expect(result.current.isLoading).toBe(false);
  });

  it("認証切れでは結果にせず安全な案内を返し再操作可能に戻る", async () => {
    affirmationMocks.generateAffirmation.mockResolvedValueOnce({
      status: "auth_required",
      message: "ログイン状態を確認できませんでした。ログインし直してください。",
    });
    const { result } = renderHook(() => useAffirmationGenerator());

    await act(async () => {
      await result.current.handleGenerateAffirmation();
    });

    expect(result.current.text).toBe("");
    expect(result.current.authError).toContain("ログインし直してください");
    expect(result.current.isLoading).toBe(false);
  });

  it("同一タイミングで連続実行してもgenerateAffirmationを1回だけ呼ぶ", async () => {
    const generateDeferred = createDeferred<GeminiActionResult>();
    affirmationMocks.generateAffirmation.mockReturnValue(generateDeferred.promise);
    const { result } = renderHook(() => useAffirmationGenerator());

    act(() => {
      void result.current.handleGenerateAffirmation();
      void result.current.handleGenerateAffirmation();
    });

    expect(affirmationMocks.generateAffirmation).toHaveBeenCalledTimes(1);

    await act(async () => {
      generateDeferred.resolve({ status: "success", text: "一度だけ生成しました" });
      await generateDeferred.promise;
    });

    expect(result.current.text).toBe("一度だけ生成しました");
    expect(result.current.isLoading).toBe(false);
  });
});
