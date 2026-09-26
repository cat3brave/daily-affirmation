/**
 * @vitest-environment node
 */

import type { CookieOptions } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AuthExchangeResult = {
  error: Error | null;
};

type CookieValue = {
  name: string;
  value: string;
};

type CookieStore = {
  getAll: ReturnType<typeof vi.fn<() => CookieValue[]>>;
  set: ReturnType<
    typeof vi.fn<
      (cookie: { name: string; value: string } & CookieOptions) => void
    >
  >;
};

type CookieAdapter = {
  getAll: () => CookieValue[];
  setAll: (cookies: Array<CookieValue & { options: CookieOptions }>) => void;
};

type ServerClientOptions = {
  cookies: CookieAdapter;
};

type SupabaseClient = {
  auth: {
    exchangeCodeForSession: ReturnType<
      typeof vi.fn<(code: string) => Promise<AuthExchangeResult>>
    >;
  };
};

const routeMocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn<
    (code: string) => Promise<AuthExchangeResult>
  >();
  const supabaseClient: SupabaseClient = {
    auth: { exchangeCodeForSession },
  };
  const cookies = vi.fn<() => Promise<CookieStore>>();
  const createServerClient = vi.fn<
    (url: string, key: string, options: ServerClientOptions) => SupabaseClient
  >();

  return {
    cookies,
    createServerClient,
    exchangeCodeForSession,
    supabaseClient,
  };
});

vi.mock("next/headers", () => ({
  cookies: routeMocks.cookies,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: routeMocks.createServerClient,
}));

import { GET } from "./route";

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createCookieStore(): CookieStore {
  return {
    getAll: vi.fn<() => CookieValue[]>(),
    set: vi.fn<
      (cookie: { name: string; value: string } & CookieOptions) => void
    >(),
  };
}

function createRequest(path: string): Request {
  return new Request(`https://example.test${path}`);
}

function expectRedirect(response: Response, expectedUrl: string) {
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(expectedUrl);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy-anon-key";

  routeMocks.cookies.mockReset();
  routeMocks.createServerClient.mockReset();
  routeMocks.exchangeCodeForSession.mockReset();

  routeMocks.cookies.mockResolvedValue(createCookieStore());
  routeMocks.createServerClient.mockReturnValue(routeMocks.supabaseClient);
  routeMocks.exchangeCodeForSession.mockResolvedValue({ error: null });
});

afterEach(() => {
  if (ORIGINAL_SUPABASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
  }

  if (ORIGINAL_SUPABASE_ANON_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_SUPABASE_ANON_KEY;
  }

  vi.restoreAllMocks();
});

describe("GET /auth/callback", () => {
  it("codeがない場合、Supabaseを作成せず/loginへリダイレクトする", async () => {
    const response = await GET(createRequest("/auth/callback"));

    expectRedirect(response, "https://example.test/login");
    expect(routeMocks.cookies).not.toHaveBeenCalled();
    expect(routeMocks.createServerClient).not.toHaveBeenCalled();
    expect(routeMocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("code交換成功時、exchangeCodeForSessionへcodeを渡し/へリダイレクトする", async () => {
    const response = await GET(
      createRequest("/auth/callback?code=oauth-code&next=/secret"),
    );

    expect(routeMocks.exchangeCodeForSession).toHaveBeenCalledWith(
      "oauth-code",
    );
    expectRedirect(response, "https://example.test/");
  });

  it("code交換がerrorを返した場合、console.errorを呼び/loginへリダイレクトする", async () => {
    const error = new Error("exchange failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    routeMocks.exchangeCodeForSession.mockResolvedValue({ error });

    const response = await GET(createRequest("/auth/callback?code=bad-code"));

    expect(consoleError).toHaveBeenCalledWith(
      "OAuth code exchange failed:",
      error,
    );
    expectRedirect(response, "https://example.test/login");
  });

  it("code交換がthrowした場合、例外を伝播させず/loginへリダイレクトする", async () => {
    const error = new Error("exchange exploded");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    routeMocks.exchangeCodeForSession.mockRejectedValue(error);

    let caughtError: unknown;
    let response: Response | undefined;
    try {
      response = await GET(createRequest("/auth/callback?code=bad-code"));
    } catch (errorFromRoute) {
      caughtError = errorFromRoute;
    }

    expect(caughtError).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("OAuth callback failed:", error);
    expect(response).toBeDefined();
    expectRedirect(response, "https://example.test/login");
  });

  it("cookies取得がthrowした場合も/loginへリダイレクトする", async () => {
    const error = new Error("cookies exploded");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    routeMocks.cookies.mockRejectedValue(error);

    const response = await GET(createRequest("/auth/callback?code=oauth-code"));

    expect(consoleError).toHaveBeenCalledWith("OAuth callback failed:", error);
    expect(routeMocks.createServerClient).not.toHaveBeenCalled();
    expectRedirect(response, "https://example.test/login");
  });

  it("共通Cookieアダプターで更新と削除を同期する", async () => {
    const cookieStore = createCookieStore();
    cookieStore.getAll.mockReturnValue([{ name: "session", value: "stored" }]);
    routeMocks.cookies.mockResolvedValue(cookieStore);
    await GET(createRequest("/auth/callback?code=oauth-code"));
    const adapter = routeMocks.createServerClient.mock.calls[0][2].cookies;
    expect(adapter.getAll()).toEqual([{ name: "session", value: "stored" }]);
    adapter.setAll([{ name: "session", value: "updated", options: { path: "/" } }]);
    expect(cookieStore.set).toHaveBeenCalledWith("session", "updated", { path: "/" });
    adapter.setAll([{ name: "session", value: "", options: { maxAge: 0 } }]);
    expect(cookieStore.set).toHaveBeenCalledWith("session", "", { maxAge: 0 });
  });
});
