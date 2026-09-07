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
    await advanceTimers(2000);
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
  });

  it("完了後にもう一度おこなうで初期状態へ戻る", async () => {
    render(<BreathingCard />);

    startBreathing();
    await advanceTimers(48000);
    fireEvent.click(screen.getByRole("button", { name: "もう一度おこなう" }));

    expect(screen.getByText("準備ができたらスタート")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "深呼吸をはじめる" }),
    ).toBeInTheDocument();
  });
});
