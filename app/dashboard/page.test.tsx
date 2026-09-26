import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), redirect: vi.fn() }));
vi.mock("../lib/supabaseServer", () => ({ getAuthenticatedUser: mocks.getAuthenticatedUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./DashboardClient", () => ({ default: () => null }));
import DashboardPage from "./page";
beforeEach(() => { mocks.redirect.mockImplementation(() => { throw new Error("redirect"); }); });
it("未認証ではクライアントを返さずログインへ戻す", async () => {
  mocks.getAuthenticatedUser.mockResolvedValue(null);
  await expect(DashboardPage()).rejects.toThrow("redirect");
  expect(mocks.redirect).toHaveBeenCalledWith("/login");
});
it("検証済みIDとメールだけをクライアントへ渡す", async () => {
  mocks.getAuthenticatedUser.mockResolvedValue({ id: "user", email: "user@example.test", access_token: "secret", metadata: {} });
  const element = await DashboardPage();
  expect(element.props).toEqual({ user: { id: "user", email: "user@example.test" } });
  expect(mocks.redirect).not.toHaveBeenCalled();
});
