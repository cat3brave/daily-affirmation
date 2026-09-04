import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
};

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ animate, exit, initial, ...props }: MotionDivProps) => {
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
vi.mock("./ThreeGoodThingsCard", () => ({ default: () => <article>3つのよかったこと</article> }));

import WorkTab from "./WorkTab";

afterEach(cleanup);

describe("WorkTab", () => {
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
