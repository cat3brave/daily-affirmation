// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";
const mocks = vi.hoisted(() => ({ create: vi.fn(), exchange: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
import { GET } from "./route";
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  mocks.create.mockReturnValue({ auth: { exchangeCodeForSession: mocks.exchange } });
  mocks.exchange.mockResolvedValue({ data: { user: { id: "user" }, session: {} }, error: null });
});
it.each(["https://evil.test", "//evil.test", "/dashboard", "javascript:alert(1)"])("交換成功はnext=%sを無視しCookieとキャッシュ禁止ヘッダーを返す", async (next) => {
  mocks.exchange.mockImplementation(async () => {
    const adapter: CookieMethodsServer = mocks.create.mock.calls[0][2].cookies;
    expect(await adapter.getAll()).toContainEqual({ name: "verifier", value: "cookie-secret" });
    await adapter.setAll!([{ name: "session", value: "session-secret", options: { path: "/", sameSite: "lax", secure: true } }], { "Cache-Control": "private, no-store", Pragma: "no-cache", Expires: "0" });
    return { data: { user: { id: "user" }, session: {} }, error: null };
  });
  const response = await GET(new NextRequest(`https://app.test/auth/recovery?code=code-secret&next=${encodeURIComponent(next)}`, { headers: { cookie: "verifier=cookie-secret" } }));
  expect(mocks.exchange).toHaveBeenCalledWith("code-secret");
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/reset-password");
  expect(response.cookies.get("session")).toMatchObject({ value: "session-secret", sameSite: "lax", secure: true });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
it.each(["missing", "provider-error", "error", "throw", "no-session", "no-user", "config"])("%s は既存セッションに関わらず失敗し機密情報を公開しない", async (mode) => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  if (mode === "error") mocks.exchange.mockResolvedValue({ data: { user: { id: "old-user" }, session: {} }, error: new Error("internal-secret") });
  if (mode === "throw") mocks.exchange.mockRejectedValue(new Error("internal-secret"));
  if (mode === "no-session") mocks.exchange.mockResolvedValue({ data: { user: { id: "user" }, session: null }, error: null });
  if (mode === "no-user") mocks.exchange.mockResolvedValue({ data: { user: null, session: {} }, error: null });
  if (mode === "config") vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  const query = mode === "missing" ? "?recovery=true" : "?code=secret" + (mode === "provider-error" ? "&error=denied&error_description=secret" : "");
  const response = await GET(new NextRequest("https://app.test/auth/recovery" + query, { headers: { cookie: "session=old" } }));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/reset-password/invalid");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.text()).not.toContain("secret");
  expect(log).not.toHaveBeenCalled();
  if (["missing", "provider-error", "config"].includes(mode)) expect(mocks.exchange).not.toHaveBeenCalled();
});
