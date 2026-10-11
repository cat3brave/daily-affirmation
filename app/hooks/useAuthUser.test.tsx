import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
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
  const unsubscribe = vi.fn();
  let listener: (event: string, session: { user: AuthUser } | null) => void;
  const onAuthStateChange = vi.fn((callback: typeof listener) => { listener = callback; return { data: { subscription: { unsubscribe } } }; });
  const emit = (id: string | null, event = "SIGNED_IN") => listener?.(event, id ? { user: { id } } : null);
  const getUser = vi.fn<() => Promise<UserResult>>();
  const createSupabaseBrowserClient = vi.fn(() => ({
    auth: { getUser, onAuthStateChange },
  }));

  return {
    emit, onAuthStateChange, unsubscribe,
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
    auth: { getUser: authMocks.getUser, onAuthStateChange: authMocks.onAuthStateChange },
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

it("サーバー検証済みユーザーなら初回から表示し、追加の認証通信をしない", () => {
  const { result } = renderHook(() => useAuthUser({ id: USER_ID, email: USER_EMAIL }));
  expect(result.current).toMatchObject({ userId: USER_ID, userEmail: USER_EMAIL, isAuthChecked: true });
  expect(authMocks.getUser).not.toHaveBeenCalled();
});

it("別タブで本人削除を通知されたら状態と本人キャッシュだけを破棄する", async () => {
  localStorage.setItem(`favoriteAffirmations:${USER_ID}`, '["A"]');
  localStorage.setItem("favoriteAffirmations:other", '["B"]');
  const { result } = renderHook(() => useAuthUser({ id: USER_ID, email: USER_EMAIL }));
  window.dispatchEvent(new StorageEvent("storage", { key: `daily-affirmation:deleted-account:${USER_ID}`, newValue: "true" }));
  await waitFor(() => expect(result.current.userId).toBeNull());
  expect(localStorage.getItem(`favoriteAffirmations:${USER_ID}`)).toBeNull();
  expect(localStorage.getItem("favoriteAffirmations:other")).toBe('["B"]');
  localStorage.clear();
});

it("タブへ戻った時に認証を再確認して古い状態を破棄する", async () => {
  const { result } = renderHook(() => useAuthUser({ id: USER_ID, email: USER_EMAIL }));
  authMocks.getUser.mockResolvedValue(createUserResult({ user: null }));
  window.dispatchEvent(new Event("focus"));
  await waitFor(() => expect(result.current.userId).toBeNull());
  expect(authMocks.replace).toHaveBeenCalledWith("/login");
});

it("初回getUserの古いAを認証変更後に復活させない", async () => {
  let resolve!: (value: UserResult) => void;
  authMocks.getUser.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  authMocks.getUser.mockResolvedValue(createUserResult({ user: { id: "B" } }));
  const { result } = renderHook(() => useAuthUser());
  act(() => authMocks.emit("B"));
  await act(async () => { resolve(createUserResult({ user: { id: "A" } })); });
  await waitFor(() => expect(result.current.userId).toBe("B"));
});

it("初回確認中のSIGNED_OUTが古いgetUserを無効化する", async () => {
  let resolve!: (value: UserResult) => void;
  authMocks.getUser.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const { result } = renderHook(() => useAuthUser());
  act(() => authMocks.emit(null, "SIGNED_OUT"));
  await act(async () => resolve(createUserResult()));
  expect(result.current.userId).toBeNull();
  expect(result.current.isAuthChecked).toBe(false);
});

it("古いfocus再確認で新しいvisibilitychangeの確認を上書きしない", async () => {
  let resolve!: (value: UserResult) => void;
  const { result } = renderHook(() => useAuthUser({ id: USER_ID, email: USER_EMAIL }));
  authMocks.getUser.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  act(() => window.dispatchEvent(new Event("focus")));
  authMocks.getUser.mockResolvedValue(createUserResult());
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  await act(async () => resolve(createUserResult({ user: null })));
  expect(result.current.userId).toBe(USER_ID);
  expect(authMocks.replace).not.toHaveBeenCalled();
});

it("SIGNED_OUTの重複通知でログアウト完了の世代を不要に進めない", () => {
  const { result } = renderHook(() => useAuthUser({ id: USER_ID, email: USER_EMAIL }));
  act(() => authMocks.emit(null, "SIGNED_OUT"));
  const generation = result.current.authGeneration;
  act(() => authMocks.emit(null, "SIGNED_OUT"));
  expect(result.current.authGeneration).toBe(generation);
});
