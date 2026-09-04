import type { ComponentProps, ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ animate, exit, initial, transition, ...props }: MotionDivProps) => {
      void animate;
      void exit;
      void initial;
      void transition;
      return <div {...props} />;
    },
  },
}));

import FloatingCloudLayer from "./FloatingCloudLayer";

afterEach(cleanup);

describe("FloatingCloudLayer", () => {
  it("雲が0件のときメッセージを表示しない", () => {
    const { container } = render(<FloatingCloudLayer floatingClouds={[]} />);

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(screen.queryByText(/……かも？ ☁️/)).not.toBeInTheDocument();
    expect(liveRegion).toBeEmptyDOMElement();
  });

  it("雲が1件のときメッセージを穏やかに通知する", () => {
    const { container } = render(
      <FloatingCloudLayer
        floatingClouds={[
          { id: "cloud-1", text: "ひと休みしていい", x: 12, y: -80 },
        ]}
      />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(within(liveRegion as HTMLElement).getByText(/「ひと休みしていい」/)).toHaveTextContent(
      "「ひと休みしていい」……かも？ ☁️",
    );
  });

  it("複数の雲をそれぞれの文言で表示する", () => {
    render(
      <FloatingCloudLayer
        floatingClouds={[
          {
            id: "cloud-10",
            text: "今日はここまででいい",
            x: -30,
            y: -100,
          },
          {
            id: "cloud-20",
            text: "明日に任せてもいい",
            x: 40,
            y: -160,
          },
        ]}
      />,
    );

    expect(screen.getByText(/「今日はここまででいい」/)).toHaveTextContent(
      "……かも？ ☁️",
    );
    expect(screen.getByText(/「明日に任せてもいい」/)).toHaveTextContent(
      "……かも？ ☁️",
    );
  });
});
