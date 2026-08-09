import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import NotFound from "./not-found";

afterEach(() => {
  cleanup();
});

describe("NotFound", () => {
  it("見出しと説明を表示する", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "ページが見つかりませんでした" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "URLをご確認いただくか、最初の画面へお戻りください。",
      ),
    ).toBeInTheDocument();
  });

  it("最初の画面へ戻るリンクの遷移先が/である", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("link", { name: "最初の画面へ戻る" }),
    ).toHaveAttribute("href", "/");
  });
});
