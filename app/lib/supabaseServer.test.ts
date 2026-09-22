import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieStore: { getAll: vi.fn(() => []), set: vi.fn() },
  cookies: vi.fn(),
  createServerClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));

import { createSupabaseServerClient } from "./supabaseServer";

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
