import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./LogoutButton", () => ({
  default: ({ userId }: { userId: string }) => <button type="button" data-user-id={userId}>ログアウト</button>,
}));

import DashboardHeader from "./DashboardHeader";

afterEach(cleanup);

describe("DashboardHeader", () => {
  it("homeの地上状態では鳥の目線ボタンを未選択で表示する", () => {
    render(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={vi.fn()} userEmail={null} userId="user-1" />);
    const button = screen.getByRole("button", { name: "🕊️ 鳥の目線になる" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("鳥の目線状態では地上に戻るボタンを選択状態で表示する", () => {
    render(<DashboardHeader currentTab="home" isBirdView onToggleBirdView={vi.fn()} userEmail={null} userId="user-1" />);
    expect(screen.getByRole("button", { name: "🌱 地上に戻る" })).toHaveAttribute("aria-pressed", "true");
  });

  it("切り替えボタンを押すとonToggleBirdViewを1回呼ぶ", () => {
    const onToggleBirdView = vi.fn();
    render(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={onToggleBirdView} userEmail={null} userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: "🕊️ 鳥の目線になる" }));
    expect(onToggleBirdView).toHaveBeenCalledTimes(1);
  });

  it.each(["work", "amulet"] as const)("%sでは切り替えボタンを表示しない", (currentTab) => {
    render(<DashboardHeader currentTab={currentTab} isBirdView={false} onToggleBirdView={vi.fn()} userEmail={null} userId="user-1" />);
    expect(screen.queryByRole("button", { name: /鳥の目線|地上に戻る/ })).not.toBeInTheDocument();
  });

  it("メールアドレスがある場合だけユーザー名部分を表示する", () => {
    const { rerender } = render(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={vi.fn()} userEmail="hanako@example.com" userId="user-1" />);
    expect(screen.getByText("hanako さん🌷")).toBeInTheDocument();
    rerender(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={vi.fn()} userEmail={null} userId="user-1" />);
    expect(screen.queryByText("hanako さん🌷")).not.toBeInTheDocument();
  });
});


describe("ヘッダーの操作とユーザー表示", () => {
  it("書き出し導線を外し、プライバシーと現在ユーザーのログアウトを残す", () => {
    render(<DashboardHeader currentTab="home" isBirdView={false} onToggleBirdView={vi.fn()} userEmail="hanako@example.com" userId="user-1" />);
    expect(screen.queryByRole("button", { name: "データを書き出す" })).not.toBeInTheDocument();
    expect(screen.queryByText("Supabaseへ保存済みのデータのみ")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プライバシーとデータ" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("button", { name: "ログアウト" })).toHaveAttribute("data-user-id", "user-1");
  });

  it("長いユーザー名の全文をヘッダー内に保持する", () => {
    const name = "long-user-name-".repeat(20);
    render(<DashboardHeader currentTab="work" isBirdView={false} onToggleBirdView={vi.fn()} userEmail={`${name}@example.com`} userId="user-1" />);
    const user = screen.getByText(`${name} さん🌷`);
    expect(user.closest("header")).toBeInTheDocument();
    expect(user).toHaveAttribute("title", `${name} さん🌷`);
    expect(screen.getByRole("link", { name: "プライバシーとデータ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });
});
