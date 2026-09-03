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
    div: ({ animate, children, exit, initial, ...props }: MotionDivProps) => {
      void animate;
      void exit;
      void initial;
      return <div {...props}>{children}</div>;
    },
  },
}));

import AmuletTab from "./AmuletTab";

afterEach(cleanup);

describe("AmuletTab", () => {
  it("救急箱の見出し、説明文、操作ボタンを表示する", () => {
    render(<AmuletTab setShowTada={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "失敗の救急箱" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("完璧じゃなくても大丈夫。", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("失敗は「挑戦した証拠」です。", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "今日、失敗しちゃった！" }),
    ).toHaveAttribute("type", "button");
  });

  it("操作ボタンを押すとsetShowTadaへtrueを1回渡す", () => {
    const setShowTada = vi.fn();
    render(<AmuletTab setShowTada={setShowTada} />);

    fireEvent.click(
      screen.getByRole("button", { name: "今日、失敗しちゃった！" }),
    );

    expect(setShowTada).toHaveBeenCalledOnce();
    expect(setShowTada).toHaveBeenCalledWith(true);
  });
});
