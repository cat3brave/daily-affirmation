import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  initial?: unknown;
  transition?: unknown;
  variants?: unknown;
};

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  motion: {
    div: (props: MotionDivProps) => {
      const { animate, children, initial, transition, variants, ...divProps } =
        props;
      void animate;
      void initial;
      void transition;
      void variants;

      return <div {...divProps}>{children}</div>;
    },
  },
}));

import BreathingCard from "./BreathingCard";

function startBreathing() {
  fireEvent.click(screen.getByRole("button", { name: "深呼吸をはじめる" }));
}

async function advanceTimers(milliseconds: number) {
  const seconds = milliseconds / 1000;

  for (let elapsedSeconds = 0; elapsedSeconds < seconds; elapsedSeconds += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("BreathingCard", () => {
  it("移動先の見出しにフォーカスしてもタイマーは始まらない", async () => {
    const headingRef = { current: null as HTMLHeadingElement | null };
    render(<BreathingCard headingRef={headingRef} />);
    const heading = screen.getByRole("heading", { name: "🎈 4-4-8 深呼吸ナビ" });
    expect(headingRef.current).toBe(heading);
    expect(heading).toHaveAttribute("id", "breathing-guide");
    expect(heading).toHaveAttribute("tabindex", "-1");
    heading.focus();
    await advanceTimers(60000);
    expect(heading).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("準備ができたらスタート");
    expect(screen.queryByRole("button", { name: "ストップ" })).not.toBeInTheDocument();
  });

  it("開始ボタンに高コントラストの背景色を使用する", () => {
    render(<BreathingCard />);

    expect(
      screen.getByRole("button", { name: "深呼吸をはじめる" }),
    ).toHaveClass("bg-sky-700");
  });
  it("初期状態で開始案内と深呼吸をはじめるを表示する", () => {
    render(<BreathingCard />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "準備ができたらスタート",
    );
    expect(
      screen.getByRole("button", { name: "深呼吸をはじめる" }),
    ).toHaveAttribute("type", "button");
  });

  it("fake timerで4秒後に止める、さらに4秒後に吐くへ進む", async () => {
    render(<BreathingCard />);

    startBreathing();
    expect(screen.getByRole("status")).toHaveTextContent(
      "鼻から深く吸って...",
    );

    await advanceTimers(4000);
    expect(screen.getByRole("status")).toHaveTextContent("そのまま止めて...");

    await advanceTimers(4000);
    expect(screen.getByRole("status")).toHaveTextContent(
      "口からゆっくり吐いて...",
    );
  });

  it("4秒吸う・4秒止める・8秒吐くを3回行うと完了表示になる", async () => {
    render(<BreathingCard />);

    startBreathing();
    await advanceTimers(48000);

    expect(screen.getByText("深呼吸のワークが完了しました🌿")).toBeInTheDocument();
    expect(
      screen.getByText("お疲れ様でした。少し心は落ち着きましたか？"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "お疲れ様でした。少し心は落ち着きましたか？",
    );
    expect(
      screen.getByRole("button", { name: "もう一度おこなう" }),
    ).toHaveAttribute("type", "button");
  });

  it("途中でストップするとidleへ戻り、その後timerを進めても再開しない", async () => {
    render(<BreathingCard />);

    startBreathing();
    await advanceTimers(21000);
    const stopButton = screen.getByRole("button", { name: "ストップ" });
    expect(stopButton).toHaveAttribute("type", "button");
    fireEvent.click(stopButton);

    expect(screen.getByText("準備ができたらスタート")).toBeInTheDocument();

    await advanceTimers(60000);

    expect(screen.getByText("準備ができたらスタート")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "深呼吸をはじめる" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("お疲れ様でした。少し心は落ち着きましたか？"),
    ).not.toBeInTheDocument();

    startBreathing();
    expect(screen.getByText("1 / 3回目")).toBeInTheDocument();
    expect(screen.getByText("4", { exact: true })).toBeInTheDocument();
    await advanceTimers(3000);
    expect(screen.getByRole("status")).toHaveTextContent("鼻から深く吸って...");
    expect(screen.getByText("1", { exact: true })).toBeInTheDocument();
    await advanceTimers(1000);
    expect(screen.getByRole("status")).toHaveTextContent("そのまま止めて...");
  });

  it("案内だけをpoliteなライブ領域で通知し、秒数は含めない", async () => {
    render(<BreathingCard />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    startBreathing();
    expect(status).toHaveTextContent(/^鼻から深く吸って\.\.\.$/);
    expect(status).not.toContainElement(screen.getByText("4", { exact: true }));
    await advanceTimers(1000);
    expect(status).toHaveTextContent(/^鼻から深く吸って\.\.\.$/);
  });

  it("完了後にもう一度おこなうを1回押すと1回目の吸う4秒から始まる", async () => {
    render(<BreathingCard />);

    startBreathing();
    await advanceTimers(48000);
    fireEvent.click(screen.getByRole("button", { name: "もう一度おこなう" }));

    expect(screen.getByRole("status")).toHaveTextContent("鼻から深く吸って...");
    expect(screen.getByText("1 / 3回目")).toBeInTheDocument();
    expect(screen.getByText("4", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ストップ" })).toBeInTheDocument();

    await advanceTimers(3000);
    expect(screen.getByRole("status")).toHaveTextContent("鼻から深く吸って...");
    expect(screen.getByText("1", { exact: true })).toBeInTheDocument();
    await advanceTimers(1000);
    expect(screen.getByRole("status")).toHaveTextContent("そのまま止めて...");
    expect(screen.getByText("4", { exact: true })).toBeInTheDocument();
    await advanceTimers(4000);
    expect(screen.getByRole("status")).toHaveTextContent("口からゆっくり吐いて...");
    expect(screen.getByText("8", { exact: true })).toBeInTheDocument();
    await advanceTimers(8000);
    expect(screen.getByText("2 / 3回目")).toBeInTheDocument();
    await advanceTimers(32000);
    expect(screen.getByRole("button", { name: "もう一度おこなう" })).toBeInTheDocument();
  });
});
