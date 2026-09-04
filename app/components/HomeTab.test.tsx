import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./AffirmationSection", () => ({
  default: () => <section aria-label="今日の言葉" />,
}));
vi.mock("./FavoriteAffirmationsList", () => ({
  default: () => <section aria-label="お気に入りの言葉" />,
}));
vi.mock("./FlowerGardenSection", () => ({
  default: () => <section aria-label="お花のお庭" />,
}));

import HomeTab from "./HomeTab";

afterEach(cleanup);

function renderHomeTab(setShowTada = vi.fn()) {
  render(
    <HomeTab
      isLoading={false}
      text=""
      handleClick={vi.fn()}
      handleFavoriteAffirmation={vi.fn()}
      handleRemoveFavoriteAffirmation={vi.fn()}
      isFavoriteDisabled={false}
      favoriteAffirmations={[]}
      favoriteError=""
      totalBlooms={0}
      growth={0}
      currentFlower="🌱"
      isBloomSaving={false}
      flowerError=""
      handleWalk={vi.fn()}
      setShowTada={setShowTada}
    />,
  );
}

describe("HomeTab", () => {
  it("主要な子セクションと有効な失敗の告白ボタンを表示する", () => {
    renderHomeTab();

    expect(screen.getByRole("region", { name: "今日の言葉" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "お気に入りの言葉" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "お花のお庭" })).toBeInTheDocument();

    const button = screen.getByRole("button", {
      name: "今日、ちょっと失敗しちゃった...",
    });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "button");
  });

  it("失敗の告白ボタンを押すとsetShowTadaへtrueを1回渡す", () => {
    const setShowTada = vi.fn();
    renderHomeTab(setShowTada);

    fireEvent.click(
      screen.getByRole("button", {
        name: "今日、ちょっと失敗しちゃった...",
      }),
    );

    expect(setShowTada).toHaveBeenCalledOnce();
    expect(setShowTada).toHaveBeenCalledWith(true);
  });
});
