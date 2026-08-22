import { forwardRef, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MotionProps<Element extends "button" | "div"> =
  ComponentProps<Element> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
    whileHover?: unknown;
    whileTap?: unknown;
  };

const { confettiMock } = vi.hoisted(() => ({
  confettiMock: vi.fn(() => <div data-testid="confetti" />),
}));

vi.mock("react-confetti", () => ({ default: confettiMock }));

vi.mock("framer-motion", () => {
  const MotionDiv = forwardRef<HTMLDivElement, MotionProps<"div">>(
    function MotionDiv(
      { animate, exit, initial, transition, children, ...props },
      ref,
    ) {
      void animate;
      void exit;
      void initial;
      void transition;
      return (
        <div ref={ref} {...props}>
          {children}
        </div>
      );
    },
  );
  const MotionButton = forwardRef<
    HTMLButtonElement,
    MotionProps<"button">
  >(function MotionButton(
    { whileHover, whileTap, children, ...props },
    ref,
  ) {
    void whileHover;
    void whileTap;
    return (
      <button ref={ref} {...props}>
        {children}
      </button>
    );
  });

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: { button: MotionButton, div: MotionDiv },
  };
});

import TadaModal from "./TadaModal";

const windowSize = { width: 1280, height: 720 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TadaModal", () => {
  it("showTada=falseではdialogとConfettiを表示しない", () => {
    render(
      <TadaModal
        showTada={false}
        setShowTada={vi.fn()}
        windowSize={windowSize}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
  });

  it("アクセシブルなdialogと説明の関連付けを表示する", () => {
    render(
      <TadaModal
        showTada
        setShowTada={vi.fn()}
        windowSize={windowSize}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Ta-Da!" });
    const title = screen.getByText("Ta-Da!");
    const description = screen.getByText(/失敗は「挑戦した証拠」であり/);

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", title.id);
    expect(dialog).toHaveAttribute("aria-describedby", description.id);
    expect(title.id).not.toBe("");
    expect(description.id).not.toBe("");
  });

  it("ConfettiへwindowSizeのwidthとheightを渡す", () => {
    render(
      <TadaModal
        showTada
        setShowTada={vi.fn()}
        windowSize={windowSize}
      />,
    );

    expect(confettiMock).toHaveBeenCalledWith(
      expect.objectContaining(windowSize),
      undefined,
    );
  });

  it("表示時にありがとうボタンへフォーカスを移す", () => {
    render(
      <TadaModal
        showTada
        setShowTada={vi.fn()}
        windowSize={windowSize}
      />,
    );

    expect(screen.getByRole("button", { name: "ありがとう!🌟" })).toHaveFocus();
  });

  it("ありがとうボタンで閉じる", () => {
    const setShowTada = vi.fn();
    render(
      <TadaModal
        showTada
        setShowTada={setShowTada}
        windowSize={windowSize}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ありがとう!🌟" }));

    expect(setShowTada).toHaveBeenCalledWith(false);
  });

  it("背景クリックで閉じる", () => {
    const setShowTada = vi.fn();
    render(
      <TadaModal
        showTada
        setShowTada={setShowTada}
        windowSize={windowSize}
      />,
    );

    fireEvent.click(screen.getByRole("dialog").parentElement!);

    expect(setShowTada).toHaveBeenCalledWith(false);
  });

  it("モーダル内部クリックでは閉じない", () => {
    const setShowTada = vi.fn();
    render(
      <TadaModal
        showTada
        setShowTada={setShowTada}
        windowSize={windowSize}
      />,
    );

    fireEvent.click(screen.getByRole("dialog"));

    expect(setShowTada).not.toHaveBeenCalled();
  });

  it("Escapeキーで閉じる", () => {
    const setShowTada = vi.fn();
    render(
      <TadaModal
        showTada
        setShowTada={setShowTada}
        windowSize={windowSize}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(setShowTada).toHaveBeenCalledWith(false);
  });

  it("閉じた時に元の要素へフォーカスを戻す", () => {
    const originalButton = document.createElement("button");
    document.body.append(originalButton);
    originalButton.focus();
    const setShowTada = vi.fn();
    const { rerender } = render(
      <TadaModal
        showTada
        setShowTada={setShowTada}
        windowSize={windowSize}
      />,
    );

    rerender(
      <TadaModal
        showTada={false}
        setShowTada={setShowTada}
        windowSize={windowSize}
      />,
    );

    expect(originalButton).toHaveFocus();
    originalButton.remove();
  });

  it("アンマウント時にフォーカスを戻しEscapeリスナーを解除する", () => {
    const originalButton = document.createElement("button");
    document.body.append(originalButton);
    originalButton.focus();
    const setShowTada = vi.fn();
    const { unmount } = render(
      <TadaModal
        showTada
        setShowTada={setShowTada}
        windowSize={windowSize}
      />,
    );

    unmount();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(originalButton).toHaveFocus();
    expect(setShowTada).not.toHaveBeenCalled();
    originalButton.remove();
  });
});
