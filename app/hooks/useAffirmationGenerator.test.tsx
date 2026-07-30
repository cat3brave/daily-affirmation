import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const affirmationMocks = vi.hoisted(() => {
  const generateAffirmation = vi.fn<() => Promise<string>>();

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
  affirmationMocks.generateAffirmation.mockResolvedValue("今日はここまでで十分ですよ");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useAffirmationGenerator", () => {
  it("生成成功時に結果をtextへ反映しisLoadingを解除する", async () => {
    affirmationMocks.generateAffirmation.mockResolvedValue(
      "私は私の作業を進めれば十分ですよ",
    );
    const { result } = renderHook(() => useAffirmationGenerator());

    await act(async () => {
      await result.current.handleGenerateAffirmation();
    });

    expect(result.current.text).toBe("私は私の作業を進めれば十分ですよ");
    expect(result.current.isLoading).toBe(false);
  });

  it("生成中はisLoading=trueになり以前のtextを空にする", async () => {
    affirmationMocks.generateAffirmation.mockResolvedValueOnce("前の言葉です");
    const { result } = renderHook(() => useAffirmationGenerator());

    await act(async () => {
      await result.current.handleGenerateAffirmation();
    });
    expect(result.current.text).toBe("前の言葉です");

    const generateDeferred = createDeferred<string>();
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
      generateDeferred.resolve("新しい言葉です");
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

    affirmationMocks.generateAffirmation.mockResolvedValueOnce("再生成できました");

    await act(async () => {
      await result.current.handleGenerateAffirmation();
    });

    expect(affirmationMocks.generateAffirmation).toHaveBeenCalledTimes(2);
    expect(result.current.text).toBe("再生成できました");
    expect(result.current.isLoading).toBe(false);
  });

  it("同一タイミングで連続実行してもgenerateAffirmationを1回だけ呼ぶ", async () => {
    const generateDeferred = createDeferred<string>();
    affirmationMocks.generateAffirmation.mockReturnValue(generateDeferred.promise);
    const { result } = renderHook(() => useAffirmationGenerator());

    act(() => {
      void result.current.handleGenerateAffirmation();
      void result.current.handleGenerateAffirmation();
    });

    expect(affirmationMocks.generateAffirmation).toHaveBeenCalledTimes(1);

    await act(async () => {
      generateDeferred.resolve("一度だけ生成しました");
      await generateDeferred.promise;
    });

    expect(result.current.text).toBe("一度だけ生成しました");
    expect(result.current.isLoading).toBe(false);
  });
});
