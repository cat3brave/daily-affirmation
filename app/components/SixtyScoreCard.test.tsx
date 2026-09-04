import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  initial?: unknown;
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ animate, initial, ...props }: MotionDivProps) => {
      void animate;
      void initial;
      return <div {...props} />;
    },
  },
}));

import SixtyScoreCard from "./SixtyScoreCard";

afterEach(cleanup);

describe("SixtyScoreCard", () => {
  it("表示ラベルでrange入力を取得でき、初期値60点と案内を表示する", () => {
    render(<SixtyScoreCard />);

    const slider = screen.getByRole("slider", {
      name: "今日の目標ラインは？",
    });

    expect(slider).toHaveValue("60");
    expect(slider).toHaveAttribute("aria-valuetext", "60点");
    expect(screen.getByRole("status")).toHaveTextContent(
      "完璧です！60点で十分素晴らしいです。",
    );
  });

  it.each([
    [40, "🌿 完璧です！60点で十分素晴らしいです。"],
    [80, "⚠️ あれ？少し背負いすぎていませんか？"],
    [100, "🛑 ストップ！完璧主義が顔を出しています。60点に戻しましょう！"],
  ])("%i点へ変更すると現在値と状態案内を更新する", (score, message) => {
    render(<SixtyScoreCard />);

    const slider = screen.getByLabelText("今日の目標ラインは？");
    fireEvent.change(slider, { target: { value: String(score) } });

    expect(slider).toHaveValue(String(score));
    expect(slider).toHaveAttribute("aria-valuetext", `${score}点`);
    expect(screen.getByRole("status")).toHaveTextContent(message);
  });
});
