import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./LogoutButton", () => ({
  default: () => <button type="button">ログアウト</button>,
}));

import DashboardHeader from "./DashboardHeader";

afterEach(cleanup);

describe("DashboardHeader", () => {
  it("homeの地上状態では鳥の目線ボタンを未選択で表示する", () => {
    render(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={vi.fn()} userEmail={null} />);
    const button = screen.getByRole("button", { name: "🕊️ 鳥の目線になる" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("鳥の目線状態では地上に戻るボタンを選択状態で表示する", () => {
    render(<DashboardHeader currentTab="home" isBirdView onToggleBirdView={vi.fn()} userEmail={null} />);
    expect(screen.getByRole("button", { name: "🌱 地上に戻る" })).toHaveAttribute("aria-pressed", "true");
  });

  it("切り替えボタンを押すとonToggleBirdViewを1回呼ぶ", () => {
    const onToggleBirdView = vi.fn();
    render(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={onToggleBirdView} userEmail={null} />);
    fireEvent.click(screen.getByRole("button", { name: "🕊️ 鳥の目線になる" }));
    expect(onToggleBirdView).toHaveBeenCalledTimes(1);
  });

  it.each(["work", "amulet"] as const)("%sでは切り替えボタンを表示しない", (currentTab) => {
    render(<DashboardHeader currentTab={currentTab} isBirdView={false} onToggleBirdView={vi.fn()} userEmail={null} />);
    expect(screen.queryByRole("button", { name: /鳥の目線|地上に戻る/ })).not.toBeInTheDocument();
  });

  it("メールアドレスがある場合だけユーザー名部分を表示する", () => {
    const { rerender } = render(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={vi.fn()} userEmail="hanako@example.com" />);
    expect(screen.getByText("hanako さん🌷")).toBeInTheDocument();
    rerender(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={vi.fn()} userEmail={null} />);
    expect(screen.queryByText("hanako さん🌷")).not.toBeInTheDocument();
  });
});
