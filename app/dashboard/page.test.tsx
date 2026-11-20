import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), redirect: vi.fn() }));
vi.mock("../lib/supabaseServer", () => ({ getAuthenticatedUser: mocks.getAuthenticatedUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./DashboardClient", () => ({ default: () => null }));
import DashboardPage from "./page";
beforeEach(() => { mocks.redirect.mockImplementation(() => { throw new Error("redirect"); }); });
afterEach(() => vi.unstubAllEnvs());
it("未認証ではクライアントを返さずログインへ戻す", async () => {
  mocks.getAuthenticatedUser.mockResolvedValue(null);
  await expect(DashboardPage()).rejects.toThrow("redirect");
  expect(mocks.redirect).toHaveBeenCalledWith("/login");
});
it.each([[undefined, true], ["true", true], ["false", false]] as const)(
  "設定が %s のとき検証済みID・メールと翻訳設定の真偽値だけを渡す",
  async (setting, translationEnabled) => {
    vi.stubEnv("GEMINI_TRANSLATION_ENABLED", setting);
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user", email: "user@example.test", access_token: "secret", metadata: {} });
    const element = await DashboardPage();
    expect(element.props).toEqual({ user: { id: "user", email: "user@example.test" }, translationEnabled });
    expect(mocks.redirect).not.toHaveBeenCalled();
  },
);
