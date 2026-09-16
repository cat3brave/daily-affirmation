import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BottomTabBar from "./BottomTabBar";

afterEach(cleanup);

describe("BottomTabBar", () => {
  it("アクセシブルな名前を持つタブリストに3つのタブを表示する", () => {
    render(<BottomTabBar currentTab="home" setCurrentTab={vi.fn()} />);

    expect(
      screen.getByRole("tablist", { name: "ダッシュボード" }),
    ).toBeInTheDocument();
    for (const name of ["ホーム", "ワーク", "お守り"]) {
      expect(screen.getByRole("tab", { name })).toHaveAttribute(
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
    "currentTabが%sの場合は対応するタブだけを選択可能なTab停止位置にする",
    (currentTab, selectedName) => {
      render(<BottomTabBar currentTab={currentTab} setCurrentTab={vi.fn()} />);

      for (const name of ["ホーム", "ワーク", "お守り"]) {
        const tab = screen.getByRole("tab", { name });
        const selected = name === selectedName;
        expect(tab).toHaveAttribute("aria-selected", String(selected));
        expect(tab).toHaveAttribute("tabindex", selected ? "0" : "-1");
        expect(tab).not.toHaveAttribute("aria-pressed");
      }
    },
  );

  it("各タブを対応するパネルへ関連付け、クリックで選択する", () => {
    const setCurrentTab = vi.fn();
    render(<BottomTabBar currentTab="home" setCurrentTab={setCurrentTab} />);

    for (const [name, id] of [
      ["ホーム", "home"],
      ["ワーク", "work"],
      ["お守り", "amulet"],
    ] as const) {
      const tab = screen.getByRole("tab", { name });
      expect(tab).toHaveAttribute("id", `dashboard-tab-${id}`);
      expect(tab).toHaveAttribute("aria-controls", `dashboard-panel-${id}`);
      fireEvent.click(tab);
    }

    expect(setCurrentTab.mock.calls).toEqual([["home"], ["work"], ["amulet"]]);
  });

  it.each([
    ["ホーム", "ArrowRight", "work", "ワーク"],
    ["ホーム", "ArrowLeft", "amulet", "お守り"],
    ["お守り", "ArrowRight", "home", "ホーム"],
    ["ホーム", "End", "amulet", "お守り"],
    ["お守り", "Home", "home", "ホーム"],
  ] as const)(
    "%sで%sを押すと%sを選択してフォーカスする",
    (startName, key, expectedTab, expectedName) => {
      const setCurrentTab = vi.fn();
      render(<BottomTabBar currentTab="home" setCurrentTab={setCurrentTab} />);

      const start = screen.getByRole("tab", { name: startName });
      start.focus();
      fireEvent.keyDown(start, { key });

      expect(setCurrentTab).toHaveBeenLastCalledWith(expectedTab);
      expect(screen.getByRole("tab", { name: expectedName })).toHaveFocus();
    },
  );
});
