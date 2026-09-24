// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import type { CookieOptions } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
import { proxy, config } from "./proxy";
type Adapter = { getAll: () => Array<{ name: string; value: string }>; setAll: (cookies: Array<{ name: string; value: string; options: CookieOptions }>) => void };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
it.each(["/dashboard", "/dashboard/nested", "/dashboard/report.csv", "/"])("未認証 %s をHTTPリダイレクトする", async (path) => {
  const response = await proxy(new NextRequest("https://app.test" + path + "?secret=ignored"));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://app.test/login");
});
it.each(["/", "/login"])("認証済み %s をdashboardへ戻す", async (path) => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  const response = await proxy(new NextRequest("https://app.test" + path));
  expect(response.headers.get("location")).toBe("https://app.test/dashboard");
});
it("認証済みdashboardは通す", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  const response = await proxy(new NextRequest("https://app.test/dashboard"));
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("公開loginは未認証でも通す", async () => {
  expect((await proxy(new NextRequest("https://app.test/login"))).status).toBe(200);
});
it.each(["error", "throw", "missing-url", "missing-key"])("認証失敗 %s は安全側に倒す", async (mode) => {
  if (mode === "error") mocks.getUser.mockResolvedValue({ data: { user: { id: "untrusted" } }, error: new Error("bad") });
  if (mode === "throw") mocks.getUser.mockRejectedValue(new Error("offline"));
  if (mode === "missing-url") delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (mode === "missing-key") delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  expect((await proxy(new NextRequest("https://app.test/dashboard"))).headers.get("location")).toBe("https://app.test/login");
});
it.each(["/dashboard", "/login"])("更新Cookieをrequestとresponseへ同期する %s", async (path) => {
  const request = new NextRequest("https://app.test" + path, { headers: { cookie: "session=old" } });
  mocks.getUser.mockImplementation(async () => {
    const adapter: Adapter = mocks.createServerClient.mock.calls[0][2].cookies;
    expect(adapter.getAll()).toContainEqual({ name: "session", value: "old" });
    adapter.setAll([{ name: "session", value: "fresh", options: { path: "/", httpOnly: true, sameSite: "lax" } }]);
    adapter.setAll([{ name: "obsolete", value: "", options: { path: "/", maxAge: 0 } }]);
    return { data: { user: { id: "user" } }, error: null };
  });
  const response = await proxy(request);
  expect(request.cookies.get("session")?.value).toBe("fresh");
  expect(response.cookies.get("session")).toMatchObject({ value: "fresh", httpOnly: true, sameSite: "lax" });
  expect(response.cookies.get("obsolete")?.maxAge).toBe(0);
  if (path === "/dashboard") expect(response.headers.get("x-middleware-request-cookie")).toContain("session=fresh");
  else expect(response.headers.get("location")).toBe("https://app.test/dashboard");
});
it("認証失敗時も削除Cookieをリダイレクトへ引き継ぐ", async () => {
  mocks.getUser.mockImplementation(async () => {
    const adapter: Adapter = mocks.createServerClient.mock.calls[0][2].cookies;
    adapter.setAll([{ name: "session", value: "", options: { maxAge: 0, path: "/" } }]);
    return { data: { user: null }, error: new Error("expired") };
  });
  const response = await proxy(new NextRequest("https://app.test/dashboard"));
  expect(response.headers.get("location")).toBe("https://app.test/login");
  expect(response.cookies.get("session")?.maxAge).toBe(0);
});
it("callbackと静的ファイルを除外しdashboard配下は拡張子付きでも保護する", () => {
  for (const url of ["/auth/callback?code=test", "/_next/static/app.js", "/_next/image?url=test", "/favicon.ico", "/google-g.svg", "/robots.txt", "/dashboard-other"]) {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false);
  }
  for (const url of ["/", "/login", "/dashboard", "/dashboard/nested", "/dashboard/report.csv"]) {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
  }
});
