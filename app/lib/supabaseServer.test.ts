import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieStore: { getAll: vi.fn(() => []), set: vi.fn() },
  cookies: vi.fn(),
  createServerClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));

import { createSupabaseServerClient, getAuthenticatedUser } from "./supabaseServer";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
  mocks.cookies.mockResolvedValue(mocks.cookieStore);
});

describe("createSupabaseServerClient", () => {
  it("next/headersのCookieを@supabase/ssrへ接続する", async () => {
    await createSupabaseServerClient();

    const options = mocks.createServerClient.mock.calls[0][2];
    expect(options.cookies.getAll()).toEqual([]);
    options.cookies.setAll([
      { name: "session", value: "updated", options: { httpOnly: true } },
    ]);
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      "session",
      "updated",
      { httpOnly: true },
    );
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])(
    "%sがない場合はクライアントを作成しない",
    async (name) => {
      delete process.env[name];

      await expect(createSupabaseServerClient()).rejects.toThrow(
        "Supabase server configuration is unavailable.",
      );
      expect(mocks.createServerClient).not.toHaveBeenCalled();
    },
  );
});

describe("getAuthenticatedUser", () => {
  it("検証済みユーザーのIDとメールだけを返す", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user", email: "test@example.test", metadata: { secret: "hidden" } } }, error: null });
    mocks.createServerClient.mockReturnValue({ auth: { getUser } });
    await expect(getAuthenticatedUser()).resolves.toEqual({ id: "user", email: "test@example.test" });
    expect(getUser).toHaveBeenCalledOnce();
  });
  it("メールがない場合は空文字を返す", async () => {
    mocks.createServerClient.mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user" } }, error: null }) } });
    await expect(getAuthenticatedUser()).resolves.toEqual({ id: "user", email: "" });
  });
  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "user" } }, error: new Error("untrusted") },
  ])("認証失敗はnullを返す %j", async (result) => {
    mocks.createServerClient.mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue(result) } });
    await expect(getAuthenticatedUser()).resolves.toBeNull();
  });
  it("例外を外へ漏らさない", async () => {
    mocks.createServerClient.mockReturnValue({ auth: { getUser: vi.fn().mockRejectedValue(new Error("secret")) } });
    await expect(getAuthenticatedUser()).resolves.toBeNull();
  });
  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])("設定不足 %s はnull", async (key) => {
    delete process.env[key];
    await expect(getAuthenticatedUser()).resolves.toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
  it("Server ComponentがCookie書込不可でも認証を確認する", async () => {
    mocks.cookieStore.set.mockImplementation(() => { throw new Error("read only"); });
    await createSupabaseServerClient();
    const adapter = mocks.createServerClient.mock.calls[0][2].cookies;
    expect(() => adapter.setAll([{ name: "session", value: "fresh", options: {} }])).not.toThrow();
  });
});
