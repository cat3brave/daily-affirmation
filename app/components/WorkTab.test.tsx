import type { ComponentProps, Ref } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  onAnimationComplete?: () => void;
};

const animation = vi.hoisted(() => ({ reduced: false, present: true, complete: undefined as (() => void) | undefined }));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => animation.reduced,
  useIsPresent: () => animation.present,
  motion: {
    div: ({ animate, exit, initial, onAnimationComplete, ...props }: MotionDivProps) => {
      animation.complete = onAnimationComplete;
      void animate;
      void exit;
      void initial;
      return <div {...props} />;
    },
  },
}));

vi.mock("./GentleTranslatorCard", () => ({ default: () => <article>やさしい翻訳</article> }));
vi.mock("./AndBalanceCard", () => ({ default: () => <article>心の天秤</article> }));
vi.mock("./MaybeCloudCard", () => ({
  default: ({ handleFloatCloud }: { handleFloatCloud: (text: string) => void }) => (
    <article>
      かも雲
      <button type="button" onClick={() => handleFloatCloud("失敗ではない")}>雲を浮かべる</button>
    </article>
  ),
}));
vi.mock("./SixtyScoreCard", () => ({ default: () => <article>60点で十分</article> }));
vi.mock("./BreathingCard", () => ({ default: () => <article>深呼吸</article> }));
vi.mock("./ThreeGoodThingsCard", () => ({ default: ({ headingRef }: { headingRef?: Ref<HTMLHeadingElement> }) => <article><h3 ref={headingRef}>3つのよかったこと</h3></article> }));

import WorkTab from "./WorkTab";

beforeEach(() => { animation.reduced = false; animation.present = true; });
afterEach(cleanup);

describe("WorkTab", () => {
  it("入場アニメーション完了後に見出しを通知し、退場中は通知しない", () => {
    const ready = vi.fn();
    const { rerender } = render(<WorkTab handleFloatCloud={vi.fn()} onGoodThingsReady={ready} />);
    expect(ready).not.toHaveBeenCalled();
    act(() => animation.complete?.());
    expect(ready).toHaveBeenCalledWith(screen.getByRole("heading", { name: "3つのよかったこと" }));
    animation.present = false;
    rerender(<WorkTab handleFloatCloud={vi.fn()} onGoodThingsReady={ready} />);
    act(() => animation.complete?.());
    expect(ready).toHaveBeenCalledOnce();
  });

  it("動きを減らす設定では描画後に見出しを通知する", () => {
    animation.reduced = true;
    const ready = vi.fn();
    render(<WorkTab handleFloatCloud={vi.fn()} onGoodThingsReady={ready} />);
    expect(ready).toHaveBeenCalledWith(screen.getByRole("heading", { name: "3つのよかったこと" }));
  });
  it("名前付きセクション内に6つのカードを表示する", () => {
    render(<WorkTab handleFloatCloud={vi.fn()} />);

    const section = screen.getByRole("region", { name: "心を整えるワーク" });
    expect(section).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });

  it("MaybeCloudCardの操作結果をhandleFloatCloudへ渡す", () => {
    const handleFloatCloud = vi.fn();
    render(<WorkTab handleFloatCloud={handleFloatCloud} />);

    fireEvent.click(screen.getByRole("button", { name: "雲を浮かべる" }));

    expect(handleFloatCloud).toHaveBeenCalledOnce();
    expect(handleFloatCloud).toHaveBeenCalledWith("失敗ではない");
  });
});
