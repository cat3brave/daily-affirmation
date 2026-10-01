import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("実装に沿った保存先、AI送信、操作と移動先を表示する", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("プライバシーとデータ");
    expect(screen.getByText(/ToDoの本文、完了状態/)).toBeInTheDocument();
    expect(screen.getByText(/localStorageへ、ユーザー別/)).toHaveTextContent("未保存の下書き");
    expect(screen.getByText(/ログアウトが成功した後/)).toHaveTextContent("現在のユーザー");
    expect(screen.getByText(/アファメーション生成にGemini API/)).toHaveTextContent("機微な情報は翻訳欄へ入力しない");
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "ダッシュボードへ" })).toHaveAttribute("href", "/dashboard");
  });
});
