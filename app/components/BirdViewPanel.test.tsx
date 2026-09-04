import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
};

vi.mock("framer-motion", () => {
  const MotionDiv = forwardRef<HTMLDivElement, MotionDivProps>(
    function MotionDiv({ animate, exit, initial, transition, children, ...props }, ref) {
      void animate;
      void exit;
      void initial;
      void transition;
      return <div ref={ref} {...props}>{children}</div>;
    },
  );
  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: { div: MotionDiv },
  };
});

import BirdViewPanel from "./BirdViewPanel";

afterEach(cleanup);

describe("BirdViewPanel", () => {
  it("homeの鳥の目線では見出し、説明、開花数を表示する", () => {
    render(<BirdViewPanel currentTab="home" isBirdView totalBlooms={7} />);
    expect(screen.getByRole("heading", { name: "🕊️ 空からの景色" })).toBeInTheDocument();
    expect(screen.getByText(/少し離れて、深呼吸してみましょう。/)).toBeInTheDocument();
    expect(screen.getByLabelText("今までに咲かせたお花 7個")).toBeInTheDocument();
  });

  it("isBirdView=falseでは表示しない", () => {
    render(<BirdViewPanel currentTab="home" isBirdView={false} totalBlooms={7} />);
    expect(screen.queryByRole("heading", { name: /空からの景色/ })).not.toBeInTheDocument();
  });

  it.each(["work", "amulet"] as const)("%sでは表示しない", (currentTab) => {
    render(<BirdViewPanel currentTab={currentTab} isBirdView totalBlooms={7} />);
    expect(screen.queryByRole("heading", { name: /空からの景色/ })).not.toBeInTheDocument();
  });
});
