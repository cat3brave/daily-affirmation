import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FavoriteAffirmationsList from "./FavoriteAffirmationsList";

afterEach(cleanup);

describe("FavoriteAffirmationsList", () => {
  it("お気に入りとエラーがない場合は何も表示しない", () => {
    const { container } = render(
      <FavoriteAffirmationsList
        favoriteAffirmations={[]}
        favoriteError=""
        handleRemoveFavoriteAffirmation={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("favoriteErrorをalertとして表示する", () => {
    render(
      <FavoriteAffirmationsList
        favoriteAffirmations={[]}
        favoriteError="お気に入りを読み込めませんでした。"
        handleRemoveFavoriteAffirmation={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "お気に入りを読み込めませんでした。",
    );
  });

  it("複数のお気に入りと対象の言葉を含む名前の削除ボタンを表示する", () => {
    render(
      <FavoriteAffirmationsList
        favoriteAffirmations={["焦らなくても大丈夫", "今日もよく頑張った"]}
        favoriteError=""
        handleRemoveFavoriteAffirmation={vi.fn()}
      />,
    );

    expect(screen.getByText("焦らなくても大丈夫")).toBeInTheDocument();
    expect(screen.getByText("今日もよく頑張った")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "「焦らなくても大丈夫」を削除" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "「今日もよく頑張った」を削除" }),
    ).toBeInTheDocument();
  });

  it("削除ボタンを押すと対応する言葉を渡して1回削除する", () => {
    const handleRemoveFavoriteAffirmation = vi.fn();
    render(
      <FavoriteAffirmationsList
        favoriteAffirmations={["焦らなくても大丈夫", "今日もよく頑張った"]}
        favoriteError=""
        handleRemoveFavoriteAffirmation={handleRemoveFavoriteAffirmation}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "「今日もよく頑張った」を削除" }),
    );

    expect(handleRemoveFavoriteAffirmation).toHaveBeenCalledOnce();
    expect(handleRemoveFavoriteAffirmation).toHaveBeenCalledWith(
      "今日もよく頑張った",
    );
  });
});
