import type { ComponentProps, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};
type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
  variants?: unknown;
};

const translatorMocks = vi.hoisted(() => {
  const translateHarshVoice = vi.fn<(text: string) => Promise<string>>();

  return {
    translateHarshVoice,
  };
});

vi.mock("../actions", () => ({
  translateHarshVoice: translatorMocks.translateHarshVoice,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: (props: MotionDivProps) => {
      const { animate, children, exit, initial, transition, variants, ...divProps } =
        props;
      void animate;
      void exit;
      void initial;
      void transition;
      void variants;

      return <div {...divProps}>{children}</div>;
    },
  },
}));

import GentleTranslatorCard from "./GentleTranslatorCard";

const FALLBACK_MESSAGE =
  "エラーが発生しました。少し休んでからもう一度試してみてくださいね。";

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

function getTextbox() {
  return screen.getByRole("textbox");
}

function getTranslateButton() {
  return screen.getByRole("button");
}

beforeEach(() => {
  translatorMocks.translateHarshVoice.mockReset();
  translatorMocks.translateHarshVoice.mockResolvedValue(
    "事実と気持ちを分けて見られていますね。",
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GentleTranslatorCard", () => {
  it("空文字・空白だけではボタンがdisabledで通信しない", () => {
    render(<GentleTranslatorCard />);

    expect(getTranslateButton()).toBeDisabled();

    fireEvent.change(getTextbox(), { target: { value: "   " } });
    fireEvent.click(getTranslateButton());

    expect(getTranslateButton()).toBeDisabled();
    expect(translatorMocks.translateHarshVoice).not.toHaveBeenCalled();
  });

  it("入力文字数とmaxLength=300を確認する", () => {
    render(<GentleTranslatorCard />);

    const textbox = getTextbox();

    expect(textbox).toHaveAttribute("maxLength", "300");
    expect(screen.getByText("0 / 300文字")).toBeInTheDocument();

    fireEvent.change(textbox, { target: { value: "厳しい声" } });

    expect(screen.getByText("4 / 300文字")).toBeInTheDocument();
  });

  it("成功時にtranslateHarshVoiceへ入力を渡し結果をstatus表示する", async () => {
    translatorMocks.translateHarshVoice.mockResolvedValue(
      "少し距離を置いて見られていますね。",
    );
    render(<GentleTranslatorCard />);

    fireEvent.change(getTextbox(), { target: { value: "  私はだめだ  " } });
    fireEvent.click(getTranslateButton());

    expect(translatorMocks.translateHarshVoice).toHaveBeenCalledWith(
      "  私はだめだ  ",
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "少し距離を置いて見られていますね。",
    );
  });

  it("翻訳中は入力とボタンがdisabledになり以前の結果を消す", async () => {
    translatorMocks.translateHarshVoice.mockResolvedValueOnce("前の翻訳です。");
    render(<GentleTranslatorCard />);

    fireEvent.change(getTextbox(), { target: { value: "最初の声" } });
    fireEvent.click(getTranslateButton());

    expect(await screen.findByRole("status")).toHaveTextContent("前の翻訳です。");

    const translateDeferred = createDeferred<string>();
    translatorMocks.translateHarshVoice.mockReturnValueOnce(
      translateDeferred.promise,
    );
    fireEvent.change(getTextbox(), { target: { value: "次の声" } });
    fireEvent.click(getTranslateButton());

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "翻訳中..." })).toBeDisabled();
    });
    expect(getTextbox()).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      translateDeferred.resolve("次の翻訳です。");
      await translateDeferred.promise;
    });

    expect(await screen.findByRole("status")).toHaveTextContent("次の翻訳です。");
    expect(getTextbox()).toBeEnabled();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("throw時にconsole.errorとalertを表示し再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("translate failed");
    translatorMocks.translateHarshVoice.mockRejectedValueOnce(error);
    render(<GentleTranslatorCard />);

    let clickError: unknown;
    try {
      fireEvent.change(getTextbox(), { target: { value: "つらい声" } });
      fireEvent.click(getTranslateButton());
    } catch (caughtError) {
      clickError = caughtError;
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK_MESSAGE);
    expect(clickError).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "優しい翻訳に失敗しました:",
      error,
    );
    expect(getTextbox()).toBeEnabled();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("同一タイミングの連続操作でもtranslateHarshVoiceを1回だけ呼ぶ", async () => {
    const translateDeferred = createDeferred<string>();
    translatorMocks.translateHarshVoice.mockReturnValue(translateDeferred.promise);
    render(<GentleTranslatorCard />);

    fireEvent.change(getTextbox(), { target: { value: "同時に押す声" } });
    fireEvent.click(getTranslateButton());
    fireEvent.click(getTranslateButton());

    expect(translatorMocks.translateHarshVoice).toHaveBeenCalledTimes(1);

    await act(async () => {
      translateDeferred.resolve("一度だけ翻訳しました。");
      await translateDeferred.promise;
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "一度だけ翻訳しました。",
    );
  });
});
