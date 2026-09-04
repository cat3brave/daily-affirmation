import { forwardRef, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MotionProps<Element extends "button" | "div"> = ComponentProps<Element> & {
  animate?: unknown;
  initial?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
};

vi.mock("framer-motion", () => {
  const MotionDiv = forwardRef<HTMLDivElement, MotionProps<"div">>(
    function MotionDiv({ animate, initial, transition, children, ...props }, ref) {
      void animate;
      void initial;
      void transition;
      return <div ref={ref} {...props}>{children}</div>;
    },
  );
  const MotionButton = forwardRef<HTMLButtonElement, MotionProps<"button">>(
    function MotionButton({ whileHover, whileTap, children, ...props }, ref) {
      void whileHover;
      void whileTap;
      return <button ref={ref} {...props}>{children}</button>;
    },
  );
  return { motion: { button: MotionButton, div: MotionDiv } };
});

import FlowerGardenSection from "./FlowerGardenSection";

afterEach(cleanup);

const renderGarden = (overrides: Partial<ComponentProps<typeof FlowerGardenSection>> = {}) => {
  const props: ComponentProps<typeof FlowerGardenSection> = {
    totalBlooms: 0,
    growth: 0,
    currentFlower: "🌻",
    isBloomSaving: false,
    flowerError: "",
    handleWalk: vi.fn(),
    ...overrides,
  };
  render(<FlowerGardenSection {...props} />);
  return props;
};

describe("FlowerGardenSection", () => {
  it("初期成長状態を案内とともに表示する", () => {
    renderGarden();
    expect(screen.getByRole("img", { name: "花の成長状態: 種を植えました。お散歩して育てよう！" })).toHaveTextContent("🌰");
    expect(screen.getByText("種を植えました。お散歩して育てよう！")).toHaveAttribute("aria-live", "polite");
  });

  it("中間の成長状態を表示する", () => {
    renderGarden({ growth: 2 });
    expect(screen.getByRole("img", { name: "花の成長状態: 葉っぱが育っています。いいペースですね！" })).toHaveTextContent("🌿");
  });

  it("満開時はcurrentFlowerと新しい種を植えるボタンを表示する", () => {
    renderGarden({ growth: 4, currentFlower: "🌻" });
    expect(screen.getByRole("img", { name: /満開のお花が咲きました/ })).toHaveTextContent("🌻");
    expect(screen.getByRole("button", { name: "新しい種を植える 🌱" })).toHaveAttribute("type", "button");
  });

  it("開花数0件では開花数を表示しない", () => {
    renderGarden({ totalBlooms: 0 });
    expect(screen.queryByLabelText(/今までに咲かせたお花/)).not.toBeInTheDocument();
  });

  it("複数の開花数をアクセシブルな名前で表示する", () => {
    renderGarden({ totalBlooms: 12 });
    expect(screen.getByLabelText("今までに咲かせたお花 12個")).toBeInTheDocument();
  });

  it("flowerErrorをalertとして表示する", () => {
    renderGarden({ flowerError: "お花を記録できませんでした" });
    expect(screen.getByRole("alert")).toHaveTextContent("お花を記録できませんでした");
  });

  it("保存中は保存中の文言を表示してボタンを無効にする", () => {
    renderGarden({ isBloomSaving: true });
    expect(screen.getByRole("button", { name: "お花を記録中... 🌸" })).toBeDisabled();
  });

  it("有効な操作ボタンを押すとhandleWalkを1回呼ぶ", () => {
    const handleWalk = vi.fn();
    renderGarden({ handleWalk });
    fireEvent.click(screen.getByRole("button", { name: "今日もお散歩した！ 💧" }));
    expect(handleWalk).toHaveBeenCalledTimes(1);
  });

  it("無効な操作ボタンを押してもhandleWalkを呼ばない", () => {
    const handleWalk = vi.fn();
    renderGarden({ handleWalk, isBloomSaving: true });
    fireEvent.click(screen.getByRole("button", { name: "お花を記録中... 🌸" }));
    expect(handleWalk).not.toHaveBeenCalled();
  });
});
