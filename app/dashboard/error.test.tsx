import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardError from "./error";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DashboardError", () => {
  it("やさしいエラー案内を表示し、内部情報は画面に表示しない", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const reset = vi.fn();
    const error = Object.assign(new Error("database connection failed"), {
      digest: "secret-digest-123",
    });

    render(<DashboardError error={error} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: "画面を表示できませんでした" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "一時的な問題かもしれません。もう一度お試しください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("database connection failed")).not.toBeInTheDocument();
    expect(screen.queryByText("secret-digest-123")).not.toBeInTheDocument();

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "dashboardで予期しないエラーが発生しました:",
        error,
      ),
    );
  });

  it("もう一度試すを押すとresetを1回呼ぶ", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();

    render(<DashboardError error={new Error("retry failure")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("ログイン画面へ戻るリンクの遷移先が/loginである", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<DashboardError error={new Error("link failure")} reset={vi.fn()} />);

    expect(
      screen.getByRole("link", { name: "ログイン画面へ戻る" }),
    ).toHaveAttribute("href", "/login");
  });
});
