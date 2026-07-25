import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SupabaseError = { message: string };
type AuthUser = {
  id: string;
  email?: string | null;
};
type UserResult = {
  data: {
    user: AuthUser | null;
  };
  error: SupabaseError | null;
};

const authMocks = vi.hoisted(() => {
  const replace = vi.fn<(path: string) => void>();
  const useRouter = vi.fn(() => ({ replace }));
  const getUser = vi.fn<() => Promise<UserResult>>();
  const createSupabaseBrowserClient = vi.fn(() => ({
    auth: { getUser },
  }));

  return {
    createSupabaseBrowserClient,
    getUser,
    replace,
    useRouter,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: authMocks.useRouter,
}));

vi.mock("../lib/supabaseClient", () => ({
  createSupabaseBrowserClient: authMocks.createSupabaseBrowserClient,
}));

import { useAuthUser } from "./useAuthUser";

const USER_ID = "auth-user-1";
const USER_EMAIL = "auth-user@example.com";

function createUserResult({
  error = null,
  user = { id: USER_ID, email: USER_EMAIL },
}: {
  error?: SupabaseError | null;
  user?: AuthUser | null;
} = {}): UserResult {
  return {
    data: { user },
    error,
  };
}

function configureAuthMock(result: UserResult) {
  authMocks.createSupabaseBrowserClient.mockReset();
  authMocks.getUser.mockReset();
  authMocks.replace.mockReset();
  authMocks.useRouter.mockReset();

  authMocks.useRouter.mockReturnValue({ replace: authMocks.replace });
  authMocks.createSupabaseBrowserClient.mockReturnValue({
    auth: { getUser: authMocks.getUser },
  });
  authMocks.getUser.mockResolvedValue(result);
}

beforeEach(() => {
  configureAuthMock(createUserResult());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useAuthUser", () => {
  it("取得成功時にuserIdとuserEmailを反映して認証確認済みにする", async () => {
    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(result.current.isAuthChecked).toBe(true);
    });
    expect(result.current.userId).toBe(USER_ID);
    expect(result.current.userEmail).toBe(USER_EMAIL);
    expect(authMocks.replace).not.toHaveBeenCalled();
  });

  it("Supabaseがerrorを返した場合はloginへ戻して認証状態を確定しない", async () => {
    configureAuthMock(
      createUserResult({
        error: { message: "auth failed" },
      }),
    );

    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(authMocks.replace).toHaveBeenCalledWith("/login");
    });
    expect(result.current.userId).toBeNull();
    expect(result.current.userEmail).toBeNull();
    expect(result.current.isAuthChecked).toBe(false);
  });

  it("userがnullの場合はloginへ戻してuserIdとuserEmailをnullのままにする", async () => {
    configureAuthMock(createUserResult({ user: null }));

    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(authMocks.replace).toHaveBeenCalledWith("/login");
    });
    expect(result.current.userId).toBeNull();
    expect(result.current.userEmail).toBeNull();
    expect(result.current.isAuthChecked).toBe(false);
  });

  it("getUserが例外をthrowしてもhook外へ伝播させずloginへ戻す", async () => {
    const error = new Error("getUser exploded");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    authMocks.getUser.mockRejectedValue(error);

    let renderError: unknown;
    let hookResult:
      | {
          current: ReturnType<typeof useAuthUser>;
        }
      | undefined;
    try {
      const hook = renderHook(() => useAuthUser());
      hookResult = hook.result;
    } catch (caughtError) {
      renderError = caughtError;
    }

    await waitFor(() => {
      expect(authMocks.replace).toHaveBeenCalledWith("/login");
    });
    expect(renderError).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "ユーザー情報取得中に想定外のエラー:",
      error,
    );
    expect(hookResult?.current.userId).toBeNull();
    expect(hookResult?.current.userEmail).toBeNull();
    expect(hookResult?.current.isAuthChecked).toBe(false);
  });
});
