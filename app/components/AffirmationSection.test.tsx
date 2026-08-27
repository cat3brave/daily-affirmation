import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MotionProps<Element extends "button" | "div" | "p"> =
  ComponentProps<Element> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
    whileHover?: unknown;
    whileTap?: unknown;
  };

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    button: ({
      children,
      whileHover,
      whileTap,
      ...props
    }: MotionProps<"button">) => {
      void whileHover;
      void whileTap;
      return <button {...props}>{children}</button>;
    },
    div: ({
      animate,
      children,
      exit,
      initial,
      transition,
      ...props
    }: MotionProps<"div">) => {
      void animate;
      void exit;
      void initial;
      void transition;
      return <div {...props}>{children}</div>;
    },
    p: ({
      animate,
      children,
      exit,
      initial,
      ...props
    }: MotionProps<"p">) => {
      void animate;
      void exit;
      void initial;
      return <p {...props}>{children}</p>;
    },
  },
}));

import AffirmationSection from "./AffirmationSection";

afterEach(cleanup);

describe("AffirmationSection", () => {
  it("初期状態で待機メッセージと有効な受け取りボタンを表示する", () => {
    render(
      <AffirmationSection
        isLoading={false}
        text=""
        handleClick={vi.fn()}
        handleFavoriteAffirmation={vi.fn()}
        isFavoriteDisabled={false}
      />,
    );

    expect(
      screen.getByText("ボタンを押して、言葉を受け取ってください"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "言葉を受け取る" }),
    ).toBeEnabled();
  });

  it("受け取りボタンをクリックするとhandleClickを1回呼ぶ", () => {
    const handleClick = vi.fn();
    render(
      <AffirmationSection
        isLoading={false}
        text=""
        handleClick={handleClick}
        handleFavoriteAffirmation={vi.fn()}
        isFavoriteDisabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "言葉を受け取る" }));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("読み込み中は表示文言とボタン名が変わりボタンを無効にする", () => {
    render(
      <AffirmationSection
        isLoading
        text=""
        handleClick={vi.fn()}
        handleFavoriteAffirmation={vi.fn()}
        isFavoriteDisabled={false}
      />,
    );

    expect(screen.getByText("言葉を紡いでいます...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "受け取り中..." }),
    ).toBeDisabled();
  });

  it("生成成功後にアファメーションと有効なお気に入りボタンを表示する", () => {
    render(
      <AffirmationSection
        isLoading={false}
        text="あなたは今日も十分にがんばっています"
        handleClick={vi.fn()}
        handleFavoriteAffirmation={vi.fn()}
        isFavoriteDisabled={false}
      />,
    );

    expect(
      screen.getByText("あなたは今日も十分にがんばっています"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "お気に入りにする 🌷" }),
    ).toBeEnabled();
  });

  it("お気に入りボタンをクリックするとhandleFavoriteAffirmationを1回呼ぶ", () => {
    const handleFavoriteAffirmation = vi.fn();
    render(
      <AffirmationSection
        isLoading={false}
        text="あなたは大切な存在です"
        handleClick={vi.fn()}
        handleFavoriteAffirmation={handleFavoriteAffirmation}
        isFavoriteDisabled={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "お気に入りにする 🌷" }),
    );

    expect(handleFavoriteAffirmation).toHaveBeenCalledOnce();
  });

  it("登録済み状態ではお気に入り済みボタンを表示して無効にする", () => {
    render(
      <AffirmationSection
        isLoading={false}
        text="あなたは大切な存在です"
        handleClick={vi.fn()}
        handleFavoriteAffirmation={vi.fn()}
        isFavoriteDisabled
      />,
    );

    expect(
      screen.getByRole("button", { name: "お気に入り済み 🌸" }),
    ).toBeDisabled();
  });
});
