import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), redirect: vi.fn() }));
vi.mock("./lib/supabaseServer", () => ({ getAuthenticatedUser: mocks.getAuthenticatedUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import LandingPage from "./page";
it.each([[null, "/login"], [{ id: "user", email: "" }, "/dashboard"]])("認証結果で遷移する %j", async (user, destination) => {
  mocks.getAuthenticatedUser.mockResolvedValue(user);
  await LandingPage();
  expect(mocks.redirect).toHaveBeenCalledWith(destination);
});
