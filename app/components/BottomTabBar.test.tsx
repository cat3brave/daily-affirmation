import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BottomTabBar from "./BottomTabBar";

afterEach(cleanup);

describe("BottomTabBar", () => {
  it("3つのタブを名前付きのbuttonとして表示する", () => {
    render(<BottomTabBar currentTab="home" setCurrentTab={vi.fn()} />);

    for (const name of ["ホーム", "ワーク", "お守り"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute(
        "type",
        "button",
      );
    }
  });

  it.each([
    ["home", "ホーム"],
    ["work", "ワーク"],
    ["amulet", "お守り"],
  ] as const)(
    "currentTabが%sの場合は対応するボタンだけを選択状態にする",
    (currentTab, selectedName) => {
      render(<BottomTabBar currentTab={currentTab} setCurrentTab={vi.fn()} />);

      for (const name of ["ホーム", "ワーク", "お守り"]) {
        expect(screen.getByRole("button", { name })).toHaveAttribute(
          "aria-pressed",
          String(name === selectedName),
        );
      }
    },
  );

  it("各ボタンを押すと対応するタブを渡す", () => {
    const setCurrentTab = vi.fn();
    render(<BottomTabBar currentTab="home" setCurrentTab={setCurrentTab} />);

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    fireEvent.click(screen.getByRole("button", { name: "ワーク" }));
    fireEvent.click(screen.getByRole("button", { name: "お守り" }));

    expect(setCurrentTab.mock.calls).toEqual([
      ["home"],
      ["work"],
      ["amulet"],
    ]);
  });
});
