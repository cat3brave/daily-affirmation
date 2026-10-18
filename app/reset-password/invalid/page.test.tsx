import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import Page from "./page";
afterEach(cleanup);
it("無効リンクから安全に再依頼できる", () => {
  render(<Page />);
  expect(screen.getByRole("alert")).toHaveTextContent("依頼時のブラウザー情報を確認できません");
  expect(screen.getByRole("link", { name: "復旧メールを再依頼する" })).toHaveAttribute("href", "/forgot-password");
});
