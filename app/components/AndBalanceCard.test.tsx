import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  initial?: unknown;
  transition?: unknown;
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ animate, initial, transition, ...props }: MotionDivProps) => {
      void animate;
      void initial;
      void transition;
      return <div {...props} />;
    },
  },
}));

import AndBalanceCard from "./AndBalanceCard";

afterEach(cleanup);

describe("AndBalanceCard", () => {
  it("表示ラベルで入力欄を取得でき、両方の有効な入力が揃うまでボタンを無効にする", () => {
    render(<AndBalanceCard />);

    const leftInput = screen.getByRole("textbox", {
      name: "起きた事実・ネガティブな思考",
    });
    const rightInput = screen.getByRole("textbox", {
      name: "並列する、もう一つの事実",
    });
    const button = screen.getByRole("button", {
      name: "天秤でバランスを取る",
    });

    expect(leftInput).toHaveValue("");
    expect(rightInput).toHaveValue("");
    expect(button).toBeDisabled();

    fireEvent.change(leftInput, { target: { value: "今日は進まなかった" } });
    fireEvent.change(rightInput, { target: { value: "   " } });
    expect(button).toBeDisabled();

    fireEvent.change(rightInput, { target: { value: "休むことはできた" } });
    expect(button).toBeEnabled();
  });

  it("操作後に結果を状態として表示し、入力を変更すると結果を隠す", () => {
    render(<AndBalanceCard />);

    const leftInput = screen.getByLabelText("起きた事実・ネガティブな思考");
    const rightInput = screen.getByLabelText("並列する、もう一つの事実");
    const button = screen.getByRole("button", {
      name: "天秤でバランスを取る",
    });

    fireEvent.change(leftInput, { target: { value: "失敗してしまった" } });
    fireEvent.change(rightInput, { target: { value: "挑戦はできた" } });
    fireEvent.click(button);

    expect(screen.getByRole("status")).toHaveTextContent(
      "どちらも、あなたの大切な真実ですね。",
    );
    expect(button).toBeDisabled();

    fireEvent.change(leftInput, { target: { value: "少し失敗した" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });
});
